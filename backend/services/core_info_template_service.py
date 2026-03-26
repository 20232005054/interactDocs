from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from db.models import CoreInfoTemplate
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper


class CoreInfoTemplateService:
    @staticmethod
    async def get_by_id(db: AsyncSession, core_template_id: UUID):
        return await CoreInfoTemplateMapper.get_by_id(db, core_template_id)

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        return await CoreInfoTemplateMapper.get_by_template_id(db, template_id)

    @staticmethod
    async def create(
        db: AsyncSession,
        template_id: UUID,
        field_name: str,
        field_key: str,
        field_type: str = "text",
        default_value: str = None,
        options: dict = None,
        is_required: bool = True,
        order_index: int = 0
    ):
        core_template = CoreInfoTemplate(
            template_id=template_id,
            field_name=field_name,
            field_key=field_key,
            field_type=field_type,
            default_value=default_value,
            options=options,
            is_required=is_required,
            order_index=order_index
        )
        return await CoreInfoTemplateMapper.create(db, core_template)

    @staticmethod
    async def update(db: AsyncSession, core_template_id: UUID, **kwargs):
        return await CoreInfoTemplateMapper.update(db, core_template_id, kwargs)

    @staticmethod
    async def delete(db: AsyncSession, core_template_id: UUID):
        return await CoreInfoTemplateMapper.delete_by_id(db, core_template_id)

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[CoreInfoTemplate]):
        return await CoreInfoTemplateMapper.batch_create(db, templates)
