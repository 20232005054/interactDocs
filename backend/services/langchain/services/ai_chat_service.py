"""
AI 对话服务

使用 LangChain 框架实现对话功能
"""

import logging
from typing import AsyncGenerator, List, Dict, Optional
from uuid import UUID

from services.langchain.agents.chat_agent import create_chat_agent

logger = logging.getLogger(__name__)


class AIChatService:
    """
    AI 对话服务
    
    使用 LangChain 框架实现：
    - DocumentChatAgent 处理对话
    - MemoryManager 管理历史
    - 工具调用（只读 + 查询）
    """
    
    @staticmethod
    async def chat_stream(
        document_id: UUID,
        message: str,
        current_chapter_id: Optional[UUID] = None,
        selected_paragraphs: List[Dict] = None,
        selected_summaries: List[Dict] = None,
    ) -> AsyncGenerator[str, None]:
        """
        AI 聊天流式接口
        
        Args:
            document_id: 文档 ID
            message: 用户消息
            current_chapter_id: 当前章节 ID
            selected_paragraphs: 用户选中的段落
            selected_summaries: 用户选中的摘要
        
        Yields:
            SSE 格式的数据流
        """
        import json
        
        try:
            # 创建对话智能体
            agent = await create_chat_agent(document_id)
            
            # 准备上下文
            context = {}
            if current_chapter_id:
                context["chapter_id"] = str(current_chapter_id)
            if selected_paragraphs:
                context["selected_paragraphs"] = selected_paragraphs
            if selected_summaries:
                context["selected_summaries"] = selected_summaries
            
            # 流式对话
            async for chunk in agent.chat_stream(message, context):
                yield f"data: {json.dumps({'response': chunk})}\n\n"
            
            yield "data: [DONE]\n\n"
        
        except Exception as e:
            logger.error(f"[对话v2] 失败: {e}")
            yield f"data: {json.dumps({'error': f'对话失败: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"
    
    @staticmethod
    async def chat(
        document_id: UUID,
        message: str,
        current_chapter_id: Optional[UUID] = None,
        selected_paragraphs: List[Dict] = None,
        selected_summaries: List[Dict] = None,
    ) -> Dict:
        """
        AI 聊天（非流式）
        
        Args:
            document_id: 文档 ID
            message: 用户消息
            current_chapter_id: 当前章节 ID
            selected_paragraphs: 用户选中的段落
            selected_summaries: 用户选中的摘要
        
        Returns:
            对话结果 {response, actions, suggestions}
        """
        try:
            # 创建对话智能体
            agent = await create_chat_agent(document_id)
            
            # 准备上下文
            context = {}
            if current_chapter_id:
                context["chapter_id"] = str(current_chapter_id)
            if selected_paragraphs:
                context["selected_paragraphs"] = selected_paragraphs
            if selected_summaries:
                context["selected_summaries"] = selected_summaries
            
            # 对话
            result = await agent.chat(message, context)
            
            logger.info(
                f"[对话v2] 完成 document_id={document_id} "
                f"actions={len(result.get('actions', []))} "
                f"suggestions={len(result.get('suggestions', []))}"
            )
            
            return result
        
        except Exception as e:
            logger.error(f"[对话v2] 失败: {e}")
            return {
                "response": f"对话失败：{str(e)}",
                "actions": [],
                "suggestions": [],
            }
