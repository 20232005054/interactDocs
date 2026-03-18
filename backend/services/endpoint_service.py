from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.operation_history_mapper import OperationHistoryMapper
from db.models import OperationHistory
from uuid import UUID

class EndpointService:
    @staticmethod
    async def get_operation_history(db: AsyncSession, page: int = 1, page_size: int = 10):
        """
        获取操作历史记录
        """
        total, history = await OperationHistoryMapper.get_operation_history(db, page, page_size)
        
        # 构建返回数据
        items = []
        for item in history:
            items.append({
                "history_id": item.history_id,
                "chapter_id": item.chapter_id,
                "document_id": item.document_id,
                "user_id": item.user_id,
                "action": item.action,
                "content_before": item.content_before,
                "content_after": item.content_after,
                "created_at": item.created_at
            })
        
        return total, items
    
    @staticmethod
    async def create_operation_history(db: AsyncSession, chapter_id: UUID = None, document_id: UUID = None, 
                                    user_id: UUID = None, action: str = None, 
                                    content_before: str = None, content_after: str = None):
        """
        创建操作历史记录
        """
        new_history = OperationHistory(
            chapter_id=chapter_id,
            document_id=document_id,
            user_id=user_id,
            action=action,
            content_before=content_before,
            content_after=content_after
        )
        
        return await OperationHistoryMapper.create_operation_history(db, new_history)