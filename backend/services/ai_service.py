"""
AI 辅助编辑服务

重构说明：
- ai_assist_paragraph / ai_evaluate_paragraph 不再接收 db 参数
- 三阶段 session 管理：准备阶段 → 流式输出（无连接）→ 保存阶段
- 彻底解决 SSE 长连接期间占用数据库连接的问题
"""

import json
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from db.models import Paragraph, Chapter, Document, DocumentSummary
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from services.ai_client import call_qwen_stream, call_qwen_once
from services.summary_template_service import SummaryTemplateService
from services.dependency_service import DependencyService
from core.constants import EdgeSourceType, EdgeTargetType

SYSTEM_PROMPT_ASSIST = "你是一位资深的临床研究方案撰写专家，请根据提供的文档背景信息，为指定章节生成专业的正文内容。"
SYSTEM_PROMPT_EVALUATE = "你是一位资深的临床研究方案评估专家，请对提供的段落内容进行专业评估并给出改进建议。"
SYSTEM_PROMPT_SUMMARY = "你是一位资深的临床研究方案摘要撰写专家，请根据提供的文档信息生成专业的摘要内容。"


# ----------------------------------------------------------------
# 内部辅助：构建 prompt（需要 db，在准备阶段调用）
# ----------------------------------------------------------------

async def _build_assist_prompt(
    db: AsyncSession,
    paragraph: Paragraph,
    chapter: Chapter,
    document: Document,
    instruction: Optional[str] = None,
) -> str:
    parts = []

    try:
        core_info_text = await SummaryTemplateService._get_core_info_structured_text(db, document.document_id)
        if core_info_text:
            parts.append(f"【文档核心信息背景】\n{core_info_text}")
    except Exception:
        pass

    parts.append(f"当前章节：{chapter.title}")

    from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
    edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
        db, EdgeSourceType.CHAPTER, chapter.chapter_id, EdgeTargetType.SUMMARY
    )
    if edges:
        summary_texts = []
        for edge in edges:
            summary = await SummaryMapper.get_summary_by_id(db, edge.target_id)
            if summary and summary.content:
                summary_texts.append(f"  {summary.title}：{summary.content}")
        if summary_texts:
            parts.append("章节相关摘要：\n" + "\n".join(summary_texts))

    if paragraph.content and paragraph.content.strip():
        parts.append(f"当前段落内容：{paragraph.content}")

    if instruction and instruction.strip():
        parts.append(f"用户修改意见：{instruction.strip()}")
        parts.append("请根据以上修改意见，对当前段落内容进行修改完善。要求语言严谨、符合临床研究规范，直接输出段落内容，不要使用 Markdown 格式。")
    else:
        parts.append("请基于以上信息，为该章节生成一段专业的正文内容。要求语言严谨、符合临床研究规范，直接输出段落内容，不要使用 Markdown 格式。")

    return "\n\n".join(parts)


async def _build_evaluate_prompt(
    db: AsyncSession,
    paragraph: Paragraph,
    chapter: Chapter,
    document: Document,
) -> str:
    parts = []

    try:
        core_info_text = await SummaryTemplateService._get_core_info_structured_text(db, document.document_id)
        if core_info_text:
            parts.append(f"【文档核心信息背景】\n{core_info_text}")
    except Exception:
        pass

    parts.append(f"当前章节：{chapter.title}")
    parts.append(f"待评估段落内容：\n{paragraph.content}")
    parts.append(
        "请对以上段落内容进行专业评估：\n"
        "1. 分析内容的专业性、完整性和逻辑性\n"
        "2. 给出具体的评估结论\n"
        "3. 提供至少 3 条改进建议\n"
        "使用纯文本格式，不要使用 Markdown，直接输出评估结果。\n"
        "格式：先输出评估结论，然后换行输出改进建议，每条建议单独一行。"
    )

    return "\n\n".join(parts)


# ----------------------------------------------------------------
# 内部辅助：准备阶段数据结构
# ----------------------------------------------------------------

class _AssistContext:
    __slots__ = ("prompt", "chapter_id", "document_id", "upstream_summary", "instruction")

    def __init__(self, prompt, chapter_id, document_id, upstream_summary=None, instruction=None):
        self.prompt = prompt
        self.chapter_id = chapter_id
        self.document_id = document_id
        self.upstream_summary = upstream_summary
        self.instruction = instruction


class _EvaluateContext:
    __slots__ = ("prompt", "paragraph_content")

    def __init__(self, prompt, paragraph_content):
        self.prompt = prompt
        self.paragraph_content = paragraph_content


# ----------------------------------------------------------------
# 公开接口
# ----------------------------------------------------------------

async def ai_assist_paragraph(
    paragraph_id: UUID,
    assist_request=None,
    upstream_summary: dict = None,
    instruction: Optional[str] = None,
):
    """
    AI 帮填段落内容（流式）。不接收 db 参数，自行管理 session 生命周期。

    Args:
        paragraph_id: 段落ID
        assist_request: 帮填请求参数（保留兼容）
        upstream_summary: 上游摘要变更时传入
        instruction: 用户修改意见（可选）
    """
    from db.session import AsyncSessionLocal

    # ── 阶段1：准备，用完立即释放连接 ──
    ctx: Optional[_AssistContext] = None
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Paragraph, Chapter, Document)
                .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
                .join(Document, Chapter.document_id == Document.document_id)
                .where(Paragraph.paragraph_id == paragraph_id)
            )
            data = result.first()
            if not data:
                yield f"data: {json.dumps({'error': '段落不存在'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            paragraph, chapter, document = data

            if upstream_summary:
                prompt = (
                    f"【上游摘要已更新】\n"
                    f"{upstream_summary.get('title', '')}：{upstream_summary.get('content', '')}\n\n"
                    f"当前章节：{chapter.title}\n\n"
                    f"当前段落内容：{paragraph.content}\n\n"
                    f"请基于更新后的摘要，重新生成该章节的正文内容。要求语言严谨、符合临床研究规范，直接输出段落内容。"
                )
            else:
                prompt = await _build_assist_prompt(db, paragraph, chapter, document, instruction)

            ctx = _AssistContext(
                prompt=prompt,
                chapter_id=chapter.chapter_id,
                document_id=document.document_id,
                upstream_summary=upstream_summary,
                instruction=instruction,
            )
    except Exception as e:
        yield f"data: {json.dumps({'error': f'准备阶段失败: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # ── 阶段2：流式输出，不持有任何 db 连接 ──
    full_content = ""
    try:
        async for chunk in call_qwen_stream(SYSTEM_PROMPT_ASSIST, [], ctx.prompt):
            full_content += chunk
            yield f"data: {json.dumps({'content': chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': f'AI 生成失败: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # ── 阶段3：保存结果，独立 session ──
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Paragraph)
                .where(Paragraph.paragraph_id == paragraph_id)
                .values(
                    ai_generate=full_content,
                    ai_instruction=ctx.instruction if hasattr(ctx, "instruction") else None,
                )
            )

            if ctx.upstream_summary:
                try:
                    summary_id = uuid.UUID(ctx.upstream_summary["summary_id"])
                    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
                    if summary:
                        await DependencyService.create_dependency_edge(
                            db,
                            EdgeSourceType.CHAPTER,
                            ctx.chapter_id,
                            EdgeTargetType.SUMMARY,
                            summary.summary_id,
                            document_id=ctx.document_id,
                            target_version=summary.version,
                        )
                except Exception as e:
                    print(f"建立依赖边失败: {e}")

            await db.commit()
    except Exception as e:
        print(f"保存 AI 帮填结果失败: {e}")

    yield "data: [DONE]\n\n"


def ai_evaluate_paragraph(paragraph_id: UUID):
    """AI 评估段落内容（流式），返回异步生成器工厂。不接收 db 参数。"""

    async def evaluate_and_save():
        from db.session import AsyncSessionLocal

        # ── 阶段1：准备 ──
        ctx: Optional[_EvaluateContext] = None
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Paragraph, Chapter, Document)
                    .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
                    .join(Document, Chapter.document_id == Document.document_id)
                    .where(Paragraph.paragraph_id == paragraph_id)
                )
                data = result.first()
                if not data:
                    yield f"data: {json.dumps({'error': '段落不存在'})}\n\n"
                    return

                paragraph, chapter, document = data

                if not paragraph.content or not paragraph.content.strip():
                    yield f"data: {json.dumps({'error': '段落内容为空，无法评估'})}\n\n"
                    return

                prompt = await _build_evaluate_prompt(db, paragraph, chapter, document)
                ctx = _EvaluateContext(prompt=prompt, paragraph_content=paragraph.content)
        except Exception as e:
            yield f"data: {json.dumps({'error': f'准备阶段失败: {str(e)}'})}\n\n"
            return

        # ── 阶段2：流式输出 ──
        full_content = ""
        try:
            async for chunk in call_qwen_stream(SYSTEM_PROMPT_EVALUATE, [], ctx.prompt):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'AI 评估失败: {str(e)}'})}\n\n"
            return

        # 解析评估结果
        evaluation = full_content
        suggestions = []
        if "改进建议" in full_content:
            parts = full_content.split("改进建议", 1)
            evaluation = parts[0].strip()
            for line in parts[1].strip().split("\n"):
                line = line.strip()
                if line:
                    suggestions.append(line)

        # ── 阶段3：保存 ──
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Paragraph)
                    .where(Paragraph.paragraph_id == paragraph_id)
                    .values(
                        ai_eval=evaluation,
                        ai_suggestion="\n".join(suggestions) if suggestions else full_content
                    )
                )
                await db.commit()
        except Exception as e:
            print(f"保存评估结果失败: {e}")

        yield f"data: {json.dumps({'evaluation': evaluation, 'suggestions': suggestions})}\n\n"
        yield "data: [DONE]\n\n"

    return evaluate_and_save


async def assist_single_summary(db: AsyncSession, summary_id: UUID, downstream_paragraph: dict = None):
    """
    AI 帮填单个摘要（非流式，供后台任务调用）。
    此函数由调用方传入 db，不做 session 重构（非 SSE，不存在长连接问题）。
    """
    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return None

    result = await db.execute(
        select(Document).where(Document.document_id == summary.document_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        return None

    parts = []

    try:
        core_info_text = await SummaryTemplateService._get_core_info_structured_text(db, document.document_id)
        if core_info_text:
            parts.append(f"【文档核心信息背景】\n{core_info_text}")
    except Exception:
        pass

    parts.append(f"摘要标题：{summary.title}")

    if downstream_paragraph:
        parts.append(
            f"相关章节（{downstream_paragraph.get('chapter_title', '')}）内容已更新：\n"
            f"{downstream_paragraph.get('content', '')}"
        )

    if summary.content:
        parts.append(f"当前摘要内容：{summary.content}")

    parts.append("请基于以上信息，重新生成该摘要的内容。要求语言专业简洁，直接输出摘要内容。")

    prompt = "\n\n".join(parts)

    try:
        result = await call_qwen_once(SYSTEM_PROMPT_SUMMARY, [], prompt)
        new_content = result.get("content", "").strip()
        if new_content:
            await SummaryMapper.update_summary(db, summary_id, {
                "ai_generate": new_content,
                "is_change": 3
            })
        return new_content
    except Exception as e:
        print(f"AI 帮填摘要失败: {e}")
        return None
