from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.models import DocumentSummary
from uuid import UUID

class SummaryMapper:
    @staticmethod
    async def create_summary(db: AsyncSession, summary):    # 创建摘要
        db.add(summary)                                          
        await db.commit()
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
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if summary:
            for key, value in update_data.items():
                setattr(summary, key, value)
            await db.commit()
            await db.refresh(summary)
        return summary

    @staticmethod
    async def delete_summary(db: AsyncSession, summary):
        await db.delete(summary)
        await db.commit()
