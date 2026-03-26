from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from db.models import SummaryTemplate
from uuid import UUID


class SummaryTemplateMapper:
    @staticmethod
    async def get_by_id(db: AsyncSession, summary_template_id: UUID):
        result = await db.execute(
            select(SummaryTemplate).where(SummaryTemplate.summary_template_id == summary_template_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        result = await db.execute(
            select(SummaryTemplate)
            .where(SummaryTemplate.template_id == template_id)
            .order_by(SummaryTemplate.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def create(db: AsyncSession, summary_template: SummaryTemplate):
        db.add(summary_template)
        await db.commit()
        await db.refresh(summary_template)
        return summary_template

    @staticmethod
    async def update(db: AsyncSession, summary_template_id: UUID, update_data: dict):
        from sqlalchemy import update
        await db.execute(
            update(SummaryTemplate)
            .where(SummaryTemplate.summary_template_id == summary_template_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def delete_by_id(db: AsyncSession, summary_template_id: UUID):
        await db.execute(
            delete(SummaryTemplate).where(SummaryTemplate.summary_template_id == summary_template_id)
        )
        await db.commit()

    @staticmethod
    async def delete_by_template_id(db: AsyncSession, template_id: UUID):
        await db.execute(
            delete(SummaryTemplate).where(SummaryTemplate.template_id == template_id)
        )
        await db.commit()

    @staticmethod
    async def batch_create(db: AsyncSession, templates: list):
        db.add_all(templates)
        await db.commit()
        return templates
