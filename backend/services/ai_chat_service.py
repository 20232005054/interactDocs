import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from typing import AsyncGenerator, List, Dict, Any, Optional
from uuid import UUID

from db.models import Document, ChatRecord, Chapter
from services.ai_client import call_qwen_stream


class AIChatService:
    """AI聊天服务"""

    @staticmethod
    async def get_document_context(db: AsyncSession, document_id: UUID) -> Optional[Document]:
        """获取文档上下文，预加载关键词"""
        result = await db.execute(
            select(Document)
            .options(joinedload(Document.keywords))
            .where(Document.document_id == document_id)
        )
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def get_chapter_info(db: AsyncSession, chapter_id: Optional[UUID]) -> tuple:
        """获取章节信息
        
        Returns:
            tuple: (chapter, chapter_content, chapter_title)
        """
        if not chapter_id:
            return None, None, ""
        
        result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        
        if chapter:
            return chapter, chapter.content, chapter.title
        return None, None, ""

    @staticmethod
    async def get_chat_history(
        db: AsyncSession, 
        document_id: UUID, 
        limit: int = 5
    ) -> List[Dict[str, str]]:
        """获取最近的历史对话"""
        result = await db.execute(
            select(ChatRecord)
            .where(ChatRecord.document_id == document_id)
            .order_by(ChatRecord.created_at.desc())
            .limit(limit)
        )
        history = result.scalars().all()
        
        # 转换为消息格式
        return [
            {"role": "user" if i % 2 == 0 else "assistant", "content": h.message}
            for i, h in enumerate(reversed(history))
        ]

    @staticmethod
    def build_system_prompt(
        doc: Document,
        chapter_title: str = "",
        chapter_content: Any = None,
        selected_paragraphs: List[Dict] = None,
        selected_keywords: List[Dict] = None,
        selected_summaries: List[Dict] = None
    ) -> str:
        """构建系统提示词"""
        prompt_parts = [
            "你是一位临床研究 AI 助手，话很少，请直接回答。",
            f"当前项目：{doc.title}"
        ]
        
        # 处理关键词
        if doc.keywords:
            keyword_list = [keyword.keyword for keyword in doc.keywords]
            prompt_parts.append(f"关键词：{', '.join(keyword_list)}")
        else:
            prompt_parts.append("关键词：无")
        
        if doc.abstract:
            prompt_parts.append(f"正文摘要：{doc.abstract}")
        if doc.content:
            prompt_parts.append(f"参考正文：{doc.content}")
        if doc.purpose:
            prompt_parts.append(f"使用目的：{doc.purpose}")
        
        # 添加章节信息
        if chapter_title:
            prompt_parts.append(f"当前章节：{chapter_title}")
        if chapter_content:
            prompt_parts.append(f"章节内容：{json.dumps(chapter_content)}")
        
        # 添加用户选中的信息
        if selected_paragraphs:
            selected_paragraphs_text = "\n".join([
                f"段落 {i+1}：{p.get('content', '')}"
                for i, p in enumerate(selected_paragraphs)
            ])
            prompt_parts.append(f"用户选中的段落：\n{selected_paragraphs_text}")
        
        if selected_keywords:
            selected_keywords_text = ", ".join([
                k.get('keyword', '') for k in selected_keywords
            ])
            prompt_parts.append(f"用户选中的关键词：{selected_keywords_text}")
        
        if selected_summaries:
            selected_summaries_text = "\n".join([
                f"摘要 {i+1}：{s.get('title', '')} - {s.get('content', '')}"
                for i, s in enumerate(selected_summaries)
            ])
            prompt_parts.append(f"用户选中的摘要：\n{selected_summaries_text}")
        
        prompt_parts.append("你的任务是协助用户完善方案。如果用户要求修改某个指标，请给出专业建议。")
        prompt_parts.append("如果你的回答涉及具体的章节修改，请在回复末尾以 JSON 格式提供 action 指令。")
        prompt_parts.append("格式示例：[ACTION]{\"type\": \"update_chapter\", \"chapter_id\": \"xxx\", \"content\": \"...\"}")
        
        return "\n".join(prompt_parts)

    @staticmethod
    def parse_ai_response(full_response: str) -> tuple:
        """解析AI响应，分离回复内容和action指令
        
        Returns:
            tuple: (response_text, actions)
        """
        response_text = full_response
        actions = []
        
        # 检查是否包含[ACTION]指令
        if '[ACTION]' in full_response:
            parts = full_response.split('[ACTION]')
            response_text = parts[0].strip()
            if len(parts) > 1:
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
        chapter_content: Any,
        message: str,
        response: str,
        mode: str = "chat"
    ) -> None:
        """保存聊天记录"""
        new_record = ChatRecord(
            user_id=None,  # 临时设置为None，实际项目中应该从JWT中获取用户ID
            document_id=document_id,
            chapter_id=chapter_id,
            chapter_content=chapter_content,
            message=message,
            response=response,
            mode=mode
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
        selected_keywords: List[Dict] = None,
        selected_summaries: List[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """AI聊天流式响应
        
        Yields:
            SSE格式的数据流
        """
        # 1. 获取文档上下文
        doc = await AIChatService.get_document_context(db, document_id)
        if not doc:
            yield f"data: {json.dumps({'error': '文档不存在'})}\n\n"
            return
        
        # 2. 获取章节信息
        chapter, chapter_content, chapter_title = await AIChatService.get_chapter_info(
            db, current_chapter_id
        )
        
        # 3. 获取历史对话
        history_msgs = await AIChatService.get_chat_history(db, document_id)
        
        # 4. 构建系统提示词
        system_prompt = AIChatService.build_system_prompt(
            doc=doc,
            chapter_title=chapter_title,
            chapter_content=chapter_content,
            selected_paragraphs=selected_paragraphs or [],
            selected_keywords=selected_keywords or [],
            selected_summaries=selected_summaries or []
        )
        
        # 5. 调用AI流式接口
        full_response = ""
        async for chunk in call_qwen_stream(system_prompt, history_msgs, message):
            full_response += chunk
            yield f"data: {json.dumps({'response': chunk})}\n\n"
        
        # 6. 解析AI响应
        response_text, actions = AIChatService.parse_ai_response(full_response)
        
        # 7. 发送解析后的响应和action
        yield f"data: {json.dumps({'response': response_text, 'actions': actions})}\n\n"
        
        # 8. 保存聊天记录
        await AIChatService.save_chat_record(
            db=db,
            document_id=document_id,
            chapter_id=current_chapter_id,
            chapter_content=chapter_content,
            message=message,
            response=full_response
        )
        
        # 9. 发送结束标识
        yield "data: [DONE]\n\n"
