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
        db: AsyncSession,
        document_id: UUID,
        message: str,
        current_chapter_id: Optional[UUID] = None,
        selected_paragraphs: List[Dict] = None,
        selected_summaries: List[Dict] = None,
    ) -> AsyncGenerator[str, None]:
        # 1. 获取文档
        doc = await AIChatService.get_document_context(db, document_id)
        if not doc:
            yield f"data: {json.dumps({'error': '文档不存在'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # 2. 获取章节信息
        chapter, chapter_text, chapter_title = await AIChatService.get_chapter_info(
            db, current_chapter_id
        )

        # 3. 获取历史对话
        history_msgs = await AIChatService.get_chat_history(db, document_id)

        # 4. 构建上下文 prompt（作为第一条 user 消息注入）
        context_prompt = await AIChatService.build_context_prompt(
            db=db,
            doc=doc,
            chapter_title=chapter_title,
            chapter_text=chapter_text,
            selected_paragraphs=selected_paragraphs or [],
            selected_summaries=selected_summaries or [],
        )

        # 把上下文拼到用户消息前面
        full_user_message = f"{context_prompt}\n\n用户问题：{message}"

        # 5. 调用 AI 流式接口
        full_response = ""
        async for chunk in call_qwen_stream(SYSTEM_PROMPT, history_msgs, full_user_message):
            full_response += chunk
            yield f"data: {json.dumps({'response': chunk})}\n\n"

        # 6. 解析响应和 action
        response_text, actions = AIChatService.parse_ai_response(full_response)

        # 7. 发送解析后的结果
        if actions:
            yield f"data: {json.dumps({'response': response_text, 'actions': actions})}\n\n"

        # 8. 保存聊天记录
        await AIChatService.save_chat_record(
            db=db,
            document_id=document_id,
            chapter_id=current_chapter_id,
            message=message,
            response=full_response,
            role="user",
        )

        yield "data: [DONE]\n\n"
