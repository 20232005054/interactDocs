from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update as sa_update
from db.models import DocumentSummary
from uuid import UUID

class SummaryMapper:
    @staticmethod
    async def create_summary(db: AsyncSession, summary):
        db.add(summary)
        await db.flush()
        await db.refresh(summary)
        return summary

    @staticmethod
    async def get_summary_by_id(db: AsyncSession, summary_id: UUID):
        result = await db.execute(
            select(DocumentSummary)
            .where(DocumentSummary.summary_id == summary_id)
            .order_by(DocumentSummary.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_summaries_by_document_id(db: AsyncSession, document_id: UUID):
        result = await db.execute(
            select(DocumentSummary)
            .where(DocumentSummary.document_id == document_id)
            .order_by(DocumentSummary.version.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def update_summary(db: AsyncSession, summary_id: UUID, update_data):
        await db.execute(
            sa_update(DocumentSummary)
            .where(DocumentSummary.summary_id == summary_id)
            .values(**update_data)
        )
        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def delete_summary(db: AsyncSession, summary):
        await db.delete(summary)

    @staticmethod
    async def get_summaries_by_ids(db: AsyncSession, summary_ids: list) -> list:
        """批量查询摘要，避免 N+1"""
        if not summary_ids:
            return []
        result = await db.execute(
            select(DocumentSummary).where(DocumentSummary.summary_id.in_(summary_ids))
        )
        return result.scalars().all()
