import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import AsyncGenerator, List, Dict, Any, Optional
from uuid import UUID

from db.models import Document, ChatRecord, Chapter, Paragraph, DocumentSummary
from services.ai_client import call_qwen_stream
from services.summary_template_service import SummaryTemplateService

SYSTEM_PROMPT = (
    "你是一位资深的临床研究 AI 助手，协助用户完善临床研究方案文档。\n"
    "回答要专业、简洁、直接。\n"
    "如果用户要求修改某段内容，请在回复末尾附上修改建议，格式如下：\n"
    "[ACTION]{\"type\": \"suggest_edit\", \"target_type\": \"paragraph|summary\", "
    "\"target_id\": \"目标ID\", \"suggested_content\": \"修改后的内容\"}\n"
    "如果不涉及具体修改，不要输出 [ACTION]。"
)


class AIChatService:

    @staticmethod
    async def get_document_context(db: AsyncSession, document_id: UUID) -> Optional[Document]:
        result = await db.execute(
            select(Document).where(Document.document_id == document_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_chapter_info(db: AsyncSession, chapter_id: Optional[UUID]) -> tuple:
        """返回 (chapter, chapter_text, chapter_title)"""
        if not chapter_id:
            return None, "", ""
        result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return None, "", ""

        # 拼接章节下所有段落文本
        para_result = await db.execute(
            select(Paragraph)
            .where(Paragraph.chapter_id == chapter_id)
            .order_by(Paragraph.order_index)
        )
        paragraphs = para_result.scalars().all()
        chapter_text = "\n".join(p.content for p in paragraphs if p.content)
        return chapter, chapter_text, chapter.title

    @staticmethod
    async def get_chat_history(db: AsyncSession, document_id: UUID, limit: int = 10) -> List[Dict[str, str]]:
        """获取最近的历史对话，按 role 字段区分"""
        result = await db.execute(
            select(ChatRecord)
            .where(ChatRecord.document_id == document_id)
            .order_by(ChatRecord.created_at.desc())
            .limit(limit)
        )
        records = list(reversed(result.scalars().all()))

        history = []
        for r in records:
            history.append({"role": r.role or "user", "content": r.message})
            if r.response:
                history.append({"role": "assistant", "content": r.response})
        return history

    @staticmethod
    async def build_context_prompt(
        db: AsyncSession,
        doc: Document,
        chapter_title: str = "",
        chapter_text: str = "",
        selected_paragraphs: List[Dict] = None,
        selected_summaries: List[Dict] = None,
    ) -> str:
        """构建上下文 prompt，注入到 system prompt 之后、用户消息之前"""
        parts = [f"当前文档：{doc.title}"]
        if doc.purpose:
            parts.append(f"文档用途：{doc.purpose}")

        # 核心信息结构化背景
        try:
            core_info_text = await SummaryTemplateService._get_core_info_structured_text(
                db, doc.document_id
            )
            if core_info_text:
                parts.append(f"【文档核心信息背景】\n{core_info_text}")
        except Exception:
            pass

        # 文档摘要
        summary_result = await db.execute(
            select(DocumentSummary)
            .where(DocumentSummary.document_id == doc.document_id)
            .order_by(DocumentSummary.order_index)
        )
        summaries = summary_result.scalars().all()
        if summaries:
            summary_lines = [f"  {s.title}：{s.content}" for s in summaries if s.content]
            if summary_lines:
                parts.append("【文档摘要】\n" + "\n".join(summary_lines))

        # 当前章节
        if chapter_title:
            parts.append(f"【当前章节】\n章节标题：{chapter_title}")
            if chapter_text:
                parts.append(f"章节内容：\n{chapter_text}")

        # 用户选中的段落
        if selected_paragraphs:
            para_lines = [
                f"  段落 {i+1}（ID: {p.get('paragraph_id', '')}）：{p.get('content', '')}"
                for i, p in enumerate(selected_paragraphs)
            ]
            parts.append("【用户选中的段落】\n" + "\n".join(para_lines))

        # 用户选中的摘要
        if selected_summaries:
            sum_lines = [
                f"  {s.get('title', '')}（ID: {s.get('summary_id', '')}）：{s.get('content', '')}"
                for s in selected_summaries
            ]
            parts.append("【用户选中的摘要】\n" + "\n".join(sum_lines))

        return "\n\n".join(parts)

    @staticmethod
    def parse_ai_response(full_response: str) -> tuple:
        """解析 AI 响应，分离回复内容和 action 指令"""
        response_text = full_response
        actions = []
        if "[ACTION]" in full_response:
            parts = full_response.split("[ACTION]", 1)
            response_text = parts[0].strip()
            try:
                action_json = json.loads(parts[1].strip())
                actions.append(action_json)
            except json.JSONDecodeError:
                pass
        return response_text, actions

    @staticmethod
    async def save_chat_record(
        db: AsyncSession,
        document_id: UUID,
        chapter_id: Optional[UUID],
        message: str,
        response: str,
        role: str = "user",
        mode: str = "chat",
    ) -> None:
        new_record = ChatRecord(
            user_id=None,
            document_id=document_id,
            chapter_id=chapter_id,
            role=role,
            message=message,
            response=response,
            mode=mode,
        )
        db.add(new_record)
        await db.commit()

    @staticmethod
    async def chat_stream(
        document_id: UUID,
        message: str,
        current_chapter_id: Optional[UUID] = None,
        selected_paragraphs: List[Dict] = None,
        selected_summaries: List[Dict] = None,
    ) -> AsyncGenerator[str, None]:
        """
        AI 聊天流式接口（三阶段 session 分离）。不接收 db 参数，自行管理 session 生命周期。
        """
        from db.session import AsyncSessionLocal

        # ── 阶段1：准备数据，用完立即释放连接 ──
        ctx = None
        try:
            async with AsyncSessionLocal() as db:
                doc = await AIChatService.get_document_context(db, document_id)
                if not doc:
                    yield f"data: {json.dumps({'error': '文档不存在'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                chapter, chapter_text, chapter_title = await AIChatService.get_chapter_info(
                    db, current_chapter_id
                )
                history_msgs = await AIChatService.get_chat_history(db, document_id)
                context_prompt = await AIChatService.build_context_prompt(
                    db=db,
                    doc=doc,
                    chapter_title=chapter_title,
                    chapter_text=chapter_text,
                    selected_paragraphs=selected_paragraphs or [],
                    selected_summaries=selected_summaries or [],
                )
                ctx = {
                    "full_user_message": f"{context_prompt}\n\n用户问题：{message}",
                    "history_msgs": history_msgs,
                    "chapter_id": current_chapter_id,
                }
        except Exception as e:
            yield f"data: {json.dumps({'error': f'准备阶段失败: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # ── 阶段2：流式输出，不持有任何 db 连接 ──
        full_response = ""
        async for chunk in call_qwen_stream(SYSTEM_PROMPT, ctx["history_msgs"], ctx["full_user_message"]):
            full_response += chunk
            yield f"data: {json.dumps({'response': chunk})}\n\n"

        response_text, actions = AIChatService.parse_ai_response(full_response)
        if actions:
            yield f"data: {json.dumps({'response': response_text, 'actions': actions})}\n\n"

        # ── 阶段3：保存聊天记录，独立 session ──
        try:
            async with AsyncSessionLocal() as db:
                await AIChatService.save_chat_record(
                    db=db,
                    document_id=document_id,
                    chapter_id=ctx["chapter_id"],
                    message=message,
                    response=full_response,
                    role="user",
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("保存聊天记录失败: %s", e)

        yield "data: [DONE]\n\n"
