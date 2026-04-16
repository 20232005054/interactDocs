from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, update, func
from db.models import CoreInfoTemplate
from uuid import UUID
from typing import Optional, List


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
    async def get_siblings(db: AsyncSession, template_id: UUID, parent_id: Optional[UUID]):
        """获取同级节点，按 order_index 排序"""
        query = (
            select(CoreInfoTemplate)
            .where(CoreInfoTemplate.template_id == template_id)
        )
        if parent_id is None:
            query = query.where(CoreInfoTemplate.parent_id.is_(None))
        else:
            query = query.where(CoreInfoTemplate.parent_id == parent_id)
        query = query.order_by(CoreInfoTemplate.order_index)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_max_order_index(db: AsyncSession, template_id: UUID, parent_id: Optional[UUID]) -> int:
        """获取同级最大 order_index，无节点时返回 -1"""
        query = select(func.max(CoreInfoTemplate.order_index)).where(
            CoreInfoTemplate.template_id == template_id
        )
        if parent_id is None:
            query = query.where(CoreInfoTemplate.parent_id.is_(None))
        else:
            query = query.where(CoreInfoTemplate.parent_id == parent_id)
        result = await db.execute(query)
        max_val = result.scalar()
        return max_val if max_val is not None else -1

    @staticmethod
    async def shift_order_index(
        db: AsyncSession,
        template_id: UUID,
        parent_id: Optional[UUID],
        from_index: int,
        delta: int,
    ):
        """将同级中 order_index >= from_index 的节点批量偏移 delta（+1 或 -1）"""
        query = (
            update(CoreInfoTemplate)
            .where(CoreInfoTemplate.template_id == template_id)
            .where(CoreInfoTemplate.order_index >= from_index)
        )
        if parent_id is None:
            query = query.where(CoreInfoTemplate.parent_id.is_(None))
        else:
            query = query.where(CoreInfoTemplate.parent_id == parent_id)
        await db.execute(query.values(order_index=CoreInfoTemplate.order_index + delta))

    @staticmethod
    async def create(db: AsyncSession, core_info_template: CoreInfoTemplate):
        db.add(core_info_template)
        await db.flush()
        await db.refresh(core_info_template)
        return core_info_template

    @staticmethod
    async def update(db: AsyncSession, core_template_id: UUID, update_data: dict):
        await db.execute(
            update(CoreInfoTemplate)
            .where(CoreInfoTemplate.core_template_id == core_template_id)
            .values(**update_data)
        )

    @staticmethod
    async def delete_by_id(db: AsyncSession, core_template_id: UUID):
        await db.execute(
            delete(CoreInfoTemplate).where(CoreInfoTemplate.core_template_id == core_template_id)
        )

    @staticmethod
    async def delete_by_template_id(db: AsyncSession, template_id: UUID):
        await db.execute(
            delete(CoreInfoTemplate).where(CoreInfoTemplate.template_id == template_id)
        )

    @staticmethod
    async def batch_create(db: AsyncSession, templates: list):
        db.add_all(templates)
        await db.flush()
        return templates

    @staticmethod
    async def batch_update_order(db: AsyncSession, items: list[dict]):
        """批量更新 order_index，items 每项包含 core_template_id 和 order_index"""
        for item in items:
            await db.execute(
                update(CoreInfoTemplate)
                .where(CoreInfoTemplate.core_template_id == item["core_template_id"])
                .values(order_index=item["order_index"])
            )
