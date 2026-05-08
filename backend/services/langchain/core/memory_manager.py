"""
记忆管理器

提供多层记忆系统：
- 短期记忆（Buffer）：最近 N 轮对话
- 中期记忆（Summary）：自动摘要历史对话
- 长期记忆（Vector）：向量检索历史对话
- 实体记忆（Entity）：提取和追踪实体
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryBufferMemory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.models import ChatRecord
from core.config import MEMORY_TYPE, MEMORY_MAX_TOKEN_LIMIT, MEMORY_BUFFER_WINDOW
from services.langchain.core.llm_factory import get_qwen_llm

logger = logging.getLogger(__name__)


class MemoryManager:
    """记忆管理器"""
    
    def __init__(
        self,
        document_id: UUID,
        memory_type: str = "summary_buffer",
        max_token_limit: int = 2000,
        buffer_window: int = 5,
    ):
        """
        初始化
        
        Args:
            document_id: 文档 ID
            memory_type: 记忆类型（buffer_window, summary_buffer）
            max_token_limit: 最大 token 限制
            buffer_window: 缓冲窗口大小
        """
        self.document_id = document_id
        self.memory_type = memory_type
        self.max_token_limit = max_token_limit
        self.buffer_window = buffer_window
        
        # 创建记忆实例
        if memory_type == "buffer_window":
            self.memory = ConversationBufferWindowMemory(
                k=buffer_window,
                return_messages=True,
                memory_key="chat_history",
            )
        elif memory_type == "summary_buffer":
            self.memory = ConversationSummaryBufferMemory(
                llm=get_qwen_llm(),
                max_token_limit=max_token_limit,
                return_messages=True,
                memory_key="chat_history",
            )
        else:
            raise ValueError(f"不支持的记忆类型: {memory_type}")
    
    async def load_history(self, db: AsyncSession, limit: int = 10):
        """
        从数据库加载历史对话
        
        Args:
            db: 数据库会话
            limit: 加载数量
        """
        result = await db.execute(
            select(ChatRecord)
            .where(ChatRecord.document_id == self.document_id)
            .order_by(ChatRecord.created_at.desc())
            .limit(limit)
        )
        records = list(reversed(result.scalars().all()))
        
        # 加载到记忆
        for record in records:
            self.memory.chat_memory.add_message(
                HumanMessage(content=record.message)
            )
            if record.response:
                self.memory.chat_memory.add_message(
                    AIMessage(content=record.response)
                )
        
        logger.info(f"加载历史对话: document_id={self.document_id} count={len(records)}")
    
    def add_user_message(self, message: str):
        """添加用户消息"""
        self.memory.chat_memory.add_message(HumanMessage(content=message))
    
    def add_ai_message(self, message: str):
        """添加 AI 消息"""
        self.memory.chat_memory.add_message(AIMessage(content=message))
    
    def get_messages(self) -> List[BaseMessage]:
        """获取消息列表"""
        return self.memory.chat_memory.messages
    
    def get_context(self) -> Dict[str, Any]:
        """获取上下文"""
        return self.memory.load_memory_variables({})
    
    def clear(self):
        """清空记忆"""
        self.memory.clear()
    
    async def save_to_db(self, db: AsyncSession, user_message: str, ai_response: str):
        """
        保存对话到数据库
        
        Args:
            db: 数据库会话
            user_message: 用户消息
            ai_response: AI 响应
        """
        record = ChatRecord(
            document_id=self.document_id,
            role="user",
            message=user_message,
            response=ai_response,
            mode="chat",
        )
        db.add(record)
        await db.commit()
        
        logger.info(f"保存对话记录: document_id={self.document_id}")


class EntityMemory:
    """
    实体记忆
    
    提取和追踪对话中的实体（章节、段落、摘要等）
    """
    
    def __init__(self):
        self.entities: Dict[str, Any] = {}
    
    def add_entity(self, entity_type: str, entity_id: str, entity_data: Dict[str, Any]):
        """
        添加实体
        
        Args:
            entity_type: 实体类型（chapter, paragraph, summary）
            entity_id: 实体 ID
            entity_data: 实体数据
        """
        key = f"{entity_type}:{entity_id}"
        self.entities[key] = {
            "type": entity_type,
            "id": entity_id,
            "data": entity_data,
        }
    
    def get_entity(self, entity_type: str, entity_id: str) -> Optional[Dict[str, Any]]:
        """获取实体"""
        key = f"{entity_type}:{entity_id}"
        return self.entities.get(key)
    
    def get_entities_by_type(self, entity_type: str) -> List[Dict[str, Any]]:
        """获取指定类型的所有实体"""
        return [
            entity for key, entity in self.entities.items()
            if entity["type"] == entity_type
        ]
    
    def clear(self):
        """清空实体"""
        self.entities.clear()


def create_memory_manager(
    document_id: UUID,
    memory_type: Optional[str] = None,
) -> MemoryManager:
    """
    创建记忆管理器
    
    Args:
        document_id: 文档 ID
        memory_type: 记忆类型
    
    Returns:
        MemoryManager 实例
    """
    return MemoryManager(
        document_id=document_id,
        memory_type=memory_type or MEMORY_TYPE,
        max_token_limit=MEMORY_MAX_TOKEN_LIMIT,
        buffer_window=MEMORY_BUFFER_WINDOW,
    )
