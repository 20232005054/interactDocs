from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import OperationHistory
from uuid import UUID
from typing import Optional
from datetime import datetime

class OperationHistoryMapper:
    @staticmethod
    async def get_operation_history(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 10,
        document_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ):
        """获取操作历史记录（分页，支持按文档/用户/操作类型/时间范围过滤）"""
        query = select(OperationHistory)
        count_query = select(func.count()).select_from(OperationHistory)

        filters = []
        if document_id:
            filters.append(OperationHistory.document_id == document_id)
        if user_id:
            filters.append(OperationHistory.user_id == user_id)
        if action:
            filters.append(OperationHistory.action == action)
        if start_time:
            filters.append(OperationHistory.created_at >= start_time)
        if end_time:
            filters.append(OperationHistory.created_at <= end_time)

        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

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