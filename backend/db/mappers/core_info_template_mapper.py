from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from db.models import CoreInfoTemplate
from uuid import UUID


class CoreInfoTemplateMapper:
    @staticmethod
    async def get_by_id(db: AsyncSession, core_template_id: UUID):
        result = await db.execute(
            select(CoreInfoTemplate).where(CoreInfoTemplate.core_template_id == core_template_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        result = await db.execute(
            select(CoreInfoTemplate)
            .where(CoreInfoTemplate.template_id == template_id)
            .order_by(CoreInfoTemplate.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def create(db: AsyncSession, core_info_template: CoreInfoTemplate):
        db.add(core_info_template)
        await db.commit()
        await db.refresh(core_info_template)
        return core_info_template

    @staticmethod
    async def update(db: AsyncSession, core_template_id: UUID, update_data: dict):
        from sqlalchemy import update
        await db.execute(
            update(CoreInfoTemplate)
            .where(CoreInfoTemplate.core_template_id == core_template_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def delete_by_id(db: AsyncSession, core_template_id: UUID):
        await db.execute(
            delete(CoreInfoTemplate).where(CoreInfoTemplate.core_template_id == core_template_id)
        )
        await db.commit()

    @staticmethod
    async def delete_by_template_id(db: AsyncSession, template_id: UUID):
        await db.execute(
            delete(CoreInfoTemplate).where(CoreInfoTemplate.template_id == template_id)
        )
        await db.commit()

    @staticmethod
    async def batch_create(db: AsyncSession, templates: list):
        db.add_all(templates)
        await db.commit()
        return templates
