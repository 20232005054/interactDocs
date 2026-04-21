from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from uuid import UUID

from db.models import ChatRecord


class ChatMapper:

    @staticmethod
    async def get_by_document_id(
        db: AsyncSession,
        document_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ):
        """分页获取文档的对话历史，按创建时间升序"""
        count_result = await db.execute(
            select(func.count())
            .select_from(ChatRecord)
            .where(ChatRecord.document_id == document_id)
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            select(ChatRecord)
            .where(ChatRecord.document_id == document_id)
            .order_by(ChatRecord.created_at.asc())
            .offset(offset)
            .limit(page_size)
        )
        records = result.scalars().all()
        return total, records

    @staticmethod
    async def delete_by_document_id(db: AsyncSession, document_id: UUID) -> int:
        """清空文档的全部对话历史，返回删除条数"""
        from sqlalchemy import delete
        result = await db.execute(
            delete(ChatRecord).where(ChatRecord.document_id == document_id)
        )
        return result.rowcount
