"""
AI 辅助编辑服务

保留的功能：
- ai_assist_paragraph：AI 帮填段落内容（流式）
- ai_evaluate_paragraph：AI 评估段落质量（流式）
- assist_single_summary：AI 帮填单个摘要（供后台任务调用）

已删除的失效/重叠功能：
- generate_chapter_content_stream（被应用结构模板覆盖）
- generate_all_summaries（被应用摘要模板覆盖）
- is_substantial_change（已不被使用）
"""

import json
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

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


async def _build_assist_prompt(db: AsyncSession, paragraph: Paragraph, chapter: Chapter, document: Document) -> str:
    """构建 AI 帮填段落的 prompt"""
    parts = []

    # 核心信息结构化背景
    try:
        core_info_text = await SummaryTemplateService._get_core_info_structured_text(db, document.document_id)
        if core_info_text:
            parts.append(f"【文档核心信息背景】\n{core_info_text}")
    except Exception:
        pass

    # 当前章节标题
    parts.append(f"当前章节：{chapter.title}")

    # 章节相关摘要（通过依赖边查找）
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

    # 当前段落内容（如果有）
    if paragraph.content and paragraph.content.strip():
        parts.append(f"当前段落内容：{paragraph.content}")

    parts.append("请基于以上信息，为该章节生成一段专业的正文内容。要求语言严谨、符合临床研究规范，直接输出段落内容，不要使用 Markdown 格式。")

    return "\n\n".join(parts)


async def _build_evaluate_prompt(db: AsyncSession, paragraph: Paragraph, chapter: Chapter, document: Document) -> str:
    """构建 AI 评估段落的 prompt"""
    parts = []

    # 核心信息结构化背景
    try:
        core_info_text = await SummaryTemplateService._get_core_info_structured_text(db, document.document_id)
        if core_info_text:
            parts.append(f"【文档核心信息背景】\n{core_info_text}")
    except Exception:
        pass

    # 章节上下文
    parts.append(f"当前章节：{chapter.title}")

    # 段落内容
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


async def ai_assist_paragraph(db: AsyncSession, paragraph_id: UUID, assist_request, upstream_summary: dict = None):
    """
    AI 帮填段落内容（流式）

    Args:
        db: 数据库会话
        paragraph_id: 段落ID
        assist_request: 帮填请求参数
        upstream_summary: 上游摘要变更时传入，格式: {"summary_id": str, "title": str, "content": str}
    """
    try:
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

        # 构建 prompt
        if upstream_summary:
            # 上游摘要变更时，把变更摘要作为核心上下文
            prompt = (
                f"【上游摘要已更新】\n"
                f"{upstream_summary.get('title', '')}：{upstream_summary.get('content', '')}\n\n"
                f"当前章节：{chapter.title}\n\n"
                f"当前段落内容：{paragraph.content}\n\n"
                f"请基于更新后的摘要，重新生成该章节的正文内容。要求语言严谨、符合临床研究规范，直接输出段落内容。"
            )
        else:
            prompt = await _build_assist_prompt(db, paragraph, chapter, document)

        full_content = ""
        async for chunk in call_qwen_stream(SYSTEM_PROMPT_ASSIST, [], prompt):
            full_content += chunk
            yield f"data: {json.dumps({'content': chunk})}\n\n"

        # 保存 ai_generate
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(ai_generate=full_content)
        )

        # 建立章节 → 摘要依赖边（如果是基于摘要生成的）
        if upstream_summary:
            try:
                summary_id = uuid.UUID(upstream_summary["summary_id"])
                summary = await SummaryMapper.get_summary_by_id(db, summary_id)
                if summary:
                    await DependencyService.create_dependency_edge(
                        db,
                        EdgeSourceType.CHAPTER,
                        chapter.chapter_id,
                        EdgeTargetType.SUMMARY,
                        summary.summary_id,
                        document_id=document.document_id,
                        target_version=summary.version,
                    )
            except Exception as e:
                print(f"建立依赖边失败: {e}")

        await db.commit()
        yield "data: [DONE]\n\n"

    except Exception as e:
        print(f"AI 帮填失败: {e}")
        yield f"data: {json.dumps({'error': 'AI 帮填失败'})}\n\n"
        yield "data: [DONE]\n\n"


def ai_evaluate_paragraph(paragraph_id: UUID):
    """AI 评估段落内容（流式），返回一个异步生成器工厂"""

    async def evaluate_and_save(db: AsyncSession):
        try:
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

            full_content = ""
            async for chunk in call_qwen_stream(SYSTEM_PROMPT_EVALUATE, [], prompt):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            # 简单解析评估结果和建议
            evaluation = full_content
            suggestions = []
            if "改进建议" in full_content:
                parts = full_content.split("改进建议", 1)
                evaluation = parts[0].strip()
                for line in parts[1].strip().split("\n"):
                    line = line.strip()
                    if line:
                        suggestions.append(line)

            # 保存评估结果
            await db.execute(
                update(Paragraph)
                .where(Paragraph.paragraph_id == paragraph_id)
                .values(
                    ai_eval=evaluation,
                    ai_suggestion="\n".join(suggestions) if suggestions else full_content
                )
            )
            await db.commit()

            yield f"data: {json.dumps({'evaluation': evaluation, 'suggestions': suggestions})}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"AI 评估失败: {e}")
            yield f"data: {json.dumps({'error': 'AI 评估失败'})}\n\n"

    return evaluate_and_save


async def assist_single_summary(db: AsyncSession, summary_id: UUID, downstream_paragraph: dict = None):
    """
    AI 帮填单个摘要（非流式，供后台任务调用）

    Args:
        db: 数据库会话
        summary_id: 摘要ID
        downstream_paragraph: 下游段落变更信息（可选）
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

    # 构建 prompt
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
