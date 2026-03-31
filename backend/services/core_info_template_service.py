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
    async def get_template_tree(db: AsyncSession, template_id: UUID) -> List[dict]:
        templates = await CoreInfoTemplateMapper.get_by_template_id(db, template_id)
        
        template_dict_map = {}
        for t in templates:
            template_dict_map[t.core_template_id] = {
                "core_template_id": str(t.core_template_id),
                "template_id": str(t.template_id),
                "parent_id": str(t.parent_id) if t.parent_id else None,
                "field_name": t.field_name,
                "field_key": t.field_key,
                "field_type": t.field_type,
                "default_value": t.default_value,
                "options": t.options,
                "is_required": t.is_required,
                "order_index": t.order_index,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
                "children": []
            }
            
        tree = []
        for t in templates:
            node = template_dict_map[t.core_template_id]
            if t.parent_id and t.parent_id in template_dict_map:
                template_dict_map[t.parent_id]["children"].append(node)
            else:
                tree.append(node)
                
        def sort_tree(nodes):
            nodes.sort(key=lambda x: x["order_index"])
            for n in nodes:
                if n["children"]:
                    sort_tree(n["children"])
                    
        sort_tree(tree)
        return tree

    @staticmethod
    async def create(
        db: AsyncSession,
        template_id: UUID,
        field_name: str,
        field_key: str,
        parent_id: UUID = None,
        field_type: str = "text",
        default_value: str = None,
        options: dict = None,
        is_required: bool = True,
        order_index: int = 0
    ):
        core_template = CoreInfoTemplate(
            template_id=template_id,
            parent_id=parent_id,
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
        if "parent_id" in kwargs and kwargs["parent_id"] is not None:
            # 防环校验
            if str(kwargs["parent_id"]) == str(core_template_id):
                raise ValueError("父节点不能是自己")
        return await CoreInfoTemplateMapper.update(db, core_template_id, kwargs)

    @staticmethod
    async def delete(db: AsyncSession, core_template_id: UUID):
        return await CoreInfoTemplateMapper.delete_by_id(db, core_template_id)

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[CoreInfoTemplate]):
        return await CoreInfoTemplateMapper.batch_create(db, templates)
