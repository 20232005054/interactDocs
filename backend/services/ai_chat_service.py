import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import AsyncGenerator, List, Dict, Any, Optional
from uuid import UUID

from db.models import Document, ChatRecord, Chapter, Paragraph, DocumentSummary
from services.ai_client import call_qwen_stream
from services.summary_template_service import SummaryTemplateService
from core.ai_prompts import SYSTEM_PROMPT_CHAT
from services.ai_context_builder import AIContextBuilder

# 使用统一的 System Prompt
SYSTEM_PROMPT = SYSTEM_PROMPT_CHAT


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

        # 核心信息结构化背景（使用统一接口）
        try:
            core_info_text = await AIContextBuilder.get_core_info_structured_text(
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
        """
        解析 AI 响应，分离回复内容、action 指令和建议
        返回: (response_text, actions, suggestions)
        """
        response_text = full_response
        actions = []
        suggestions = []
        
        # 解析 [ACTION] 指令（保留向后兼容）
        if "[ACTION]" in full_response:
            parts = full_response.split("[ACTION]")
            response_text = parts[0].strip()
            
            for i in range(1, len(parts)):
                action_str = parts[i].strip()
                try:
                    # 提取第一个完整的 JSON 对象
                    start = action_str.find("{")
                    if start == -1:
                        continue
                    
                    brace_count = 0
                    end = start
                    for j in range(start, len(action_str)):
                        if action_str[j] == "{":
                            brace_count += 1
                        elif action_str[j] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = j + 1
                                break
                    
                    if end > start:
                        action_json = json.loads(action_str[start:end])
                        actions.append(action_json)
                except json.JSONDecodeError as e:
                    import logging
                    logging.getLogger(__name__).warning(f"解析 ACTION 失败: {e}, action_str={action_str[:100]}")
                    continue
        
        # 解析 [SUGGESTION] 建议
        if "[SUGGESTION]" in full_response:
            parts = full_response.split("[SUGGESTION]")
            # 如果没有 [ACTION]，则更新 response_text
            if "[ACTION]" not in full_response:
                response_text = parts[0].strip()
            
            for i in range(1, len(parts)):
                suggestion_str = parts[i].strip()
                try:
                    # 提取第一个完整的 JSON 对象
                    start = suggestion_str.find("{")
                    if start == -1:
                        continue
                    
                    brace_count = 0
                    end = start
                    for j in range(start, len(suggestion_str)):
                        if suggestion_str[j] == "{":
                            brace_count += 1
                        elif suggestion_str[j] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = j + 1
                                break
                    
                    if end > start:
                        suggestion_json = json.loads(suggestion_str[start:end])
                        # 验证必填字段
                        if "type" in suggestion_json:
                            suggestions.append(suggestion_json)
                except json.JSONDecodeError as e:
                    import logging
                    logging.getLogger(__name__).warning(f"解析 SUGGESTION 失败: {e}, suggestion_str={suggestion_str[:100]}")
                    continue
        
        return response_text, actions, suggestions

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

        response_text, actions, suggestions = AIChatService.parse_ai_response(full_response)
        
        # 构建最终响应
        final_data = {"response": response_text}
        if actions:
            final_data["actions"] = actions
        if suggestions:
            final_data["suggestions"] = suggestions
        
        yield f"data: {json.dumps(final_data)}\n\n"

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
