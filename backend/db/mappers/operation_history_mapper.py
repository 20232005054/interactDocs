from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import OperationHistory
from uuid import UUID
from typing import Optional

class OperationHistoryMapper:
    @staticmethod
    async def get_operation_history(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 10,
        document_id: Optional[UUID] = None,
    ):
        """获取操作历史记录（分页，支持按文档过滤）"""
        query = select(OperationHistory)
        count_query = select(func.count()).select_from(OperationHistory)

        if document_id:
            query = query.where(OperationHistory.document_id == document_id)
            count_query = count_query.where(OperationHistory.document_id == document_id)

        total = (await db.execute(count_query)).scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            query.order_by(OperationHistory.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        history = result.scalars().all()

        return total, history
    
    @staticmethod
    async def create_operation_history(db: AsyncSession, history):
        db.add(history)
        await db.flush()
        await db.refresh(history)
        return history