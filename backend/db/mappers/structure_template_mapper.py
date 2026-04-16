from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from db.models import StructureTemplate
from uuid import UUID


class StructureTemplateMapper:
    @staticmethod
    async def get_by_id(db: AsyncSession, structure_template_id: UUID):
        result = await db.execute(
            select(StructureTemplate).where(StructureTemplate.structure_template_id == structure_template_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        result = await db.execute(
            select(StructureTemplate)
            .where(StructureTemplate.template_id == template_id)
            .order_by(StructureTemplate.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_root_by_template_id(db: AsyncSession, template_id: UUID):
        result = await db.execute(
            select(StructureTemplate)
            .where(StructureTemplate.template_id == template_id)
            .where(StructureTemplate.parent_id.is_(None))
            .order_by(StructureTemplate.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_children_by_parent_id(db: AsyncSession, parent_id: UUID):
        result = await db.execute(
            select(StructureTemplate)
            .where(StructureTemplate.parent_id == parent_id)
            .order_by(StructureTemplate.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def create(db: AsyncSession, structure_template: StructureTemplate):
        db.add(structure_template)
        await db.flush()
        await db.refresh(structure_template)
        return structure_template

    @staticmethod
    async def update(db: AsyncSession, structure_template_id: UUID, update_data: dict):
        from sqlalchemy import update
        await db.execute(
            update(StructureTemplate)
            .where(StructureTemplate.structure_template_id == structure_template_id)
            .values(**update_data)
        )

    @staticmethod
    async def delete_by_id(db: AsyncSession, structure_template_id: UUID):
        await db.execute(
            delete(StructureTemplate).where(StructureTemplate.structure_template_id == structure_template_id)
        )

    @staticmethod
    async def shift_order_index(
        db: AsyncSession, template_id: UUID, parent_id, from_index: int, delta: int
    ) -> None:
        from sqlalchemy import update as sa_update
        query = (
            sa_update(StructureTemplate)
            .where(StructureTemplate.template_id == template_id)
            .where(StructureTemplate.order_index >= from_index)
        )
        if parent_id is None:
            query = query.where(StructureTemplate.parent_id.is_(None))
        else:
            query = query.where(StructureTemplate.parent_id == parent_id)
        await db.execute(query.values(order_index=StructureTemplate.order_index + delta))

    @staticmethod
    async def delete_by_template_id(db: AsyncSession, template_id: UUID):
        await db.execute(
            delete(StructureTemplate).where(StructureTemplate.template_id == template_id)
        )

    @staticmethod
    async def batch_create(db: AsyncSession, templates: list):
        db.add_all(templates)
        await db.flush()
        return templates
