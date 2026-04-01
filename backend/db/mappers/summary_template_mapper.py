from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, update, func
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

    @staticmethod
    async def get_max_order_index(db: AsyncSession, template_id: UUID) -> int:
        """返回同一 template_id 下最大 order_index，无节点时返回 -1"""
        result = await db.execute(
            select(func.max(SummaryTemplate.order_index))
            .where(SummaryTemplate.template_id == template_id)
        )
        val = result.scalar()
        return val if val is not None else -1

    @staticmethod
    async def shift_order_index(
        db: AsyncSession, template_id: UUID, from_index: int, delta: int
    ) -> None:
        """批量偏移同一 template_id 下 order_index >= from_index 的节点"""
        await db.execute(
            update(SummaryTemplate)
            .where(SummaryTemplate.template_id == template_id)
            .where(SummaryTemplate.order_index >= from_index)
            .values(order_index=SummaryTemplate.order_index + delta)
        )

    @staticmethod
    async def batch_update_order(db: AsyncSession, items: list[dict]) -> None:
        """按 summary_template_id 批量重写 order_index"""
        for item in items:
            await db.execute(
                update(SummaryTemplate)
                .where(SummaryTemplate.summary_template_id == item["summary_template_id"])
                .values(order_index=item["order_index"])
            )
        await db.commit()
