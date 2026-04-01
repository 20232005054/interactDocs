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
        order_index: int = None,
    ):
        """
        新增节点（追加到同级末尾）。
        order_index 不传时自动取同级 max+1。
        """
        if order_index is None:
            max_idx = await CoreInfoTemplateMapper.get_max_order_index(db, template_id, parent_id)
            order_index = max_idx + 1

        core_template = CoreInfoTemplate(
            template_id=template_id,
            parent_id=parent_id,
            field_name=field_name,
            field_key=field_key,
            field_type=field_type,
            default_value=default_value,
            options=options,
            is_required=is_required,
            order_index=order_index,
        )
        return await CoreInfoTemplateMapper.create(db, core_template)

    @staticmethod
    async def insert_after(
        db: AsyncSession,
        template_id: UUID,
        after_id: UUID,
        field_name: str,
        field_key: str,
        field_type: str = "text",
        default_value: str = None,
        options: dict = None,
        is_required: bool = True,
    ):
        """
        在指定节点之后插入新节点（同级）。
        将 after 节点之后的所有同级节点 order_index +1，新节点取 after.order_index+1。
        """
        after_node = await CoreInfoTemplateMapper.get_by_id(db, after_id)
        if not after_node:
            raise ValueError("参考节点不存在")

        insert_index = after_node.order_index + 1

        # 后续同级节点全部 +1
        await CoreInfoTemplateMapper.shift_order_index(
            db, template_id, after_node.parent_id, insert_index, delta=1
        )

        core_template = CoreInfoTemplate(
            template_id=template_id,
            parent_id=after_node.parent_id,
            field_name=field_name,
            field_key=field_key,
            field_type=field_type,
            default_value=default_value,
            options=options,
            is_required=is_required,
            order_index=insert_index,
        )
        return await CoreInfoTemplateMapper.create(db, core_template)

    @staticmethod
    async def delete(db: AsyncSession, core_template_id: UUID):
        """
        删除节点，并将同级后续节点 order_index -1 补位。
        子节点由数据库 CASCADE 自动删除，无需手动处理。
        """
        node = await CoreInfoTemplateMapper.get_by_id(db, core_template_id)
        if not node:
            return

        deleted_index = node.order_index
        parent_id = node.parent_id
        template_id = node.template_id

        await CoreInfoTemplateMapper.delete_by_id(db, core_template_id)

        # 后续同级节点补位
        await CoreInfoTemplateMapper.shift_order_index(
            db, template_id, parent_id, deleted_index + 1, delta=-1
        )

    @staticmethod
    async def reorder(
        db: AsyncSession,
        template_id: UUID,
        parent_id: Optional[UUID],
        ordered_ids: List[UUID],
    ):
        """
        拖拽重排：前端传入同级节点的新顺序 ID 列表，按列表下标重写 order_index。
        支持跨父节点移动：如果某节点原 parent_id 与传入 parent_id 不同，同时更新 parent_id。
        """
        from sqlalchemy import update as sa_update

        for idx, cid in enumerate(ordered_ids):
            node = await CoreInfoTemplateMapper.get_by_id(db, cid)
            if not node:
                raise ValueError(f"节点 {cid} 不存在")
            update_data: dict = {"order_index": idx}
            if node.parent_id != parent_id:
                update_data["parent_id"] = parent_id
            await db.execute(
                sa_update(CoreInfoTemplate)
                .where(CoreInfoTemplate.core_template_id == cid)
                .values(**update_data)
            )
        await db.commit()

    @staticmethod
    async def update(db: AsyncSession, core_template_id: UUID, **kwargs):
        if "parent_id" in kwargs and kwargs["parent_id"] is not None:
            if str(kwargs["parent_id"]) == str(core_template_id):
                raise ValueError("父节点不能是自己")
        return await CoreInfoTemplateMapper.update(db, core_template_id, kwargs)

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[CoreInfoTemplate]):
        return await CoreInfoTemplateMapper.batch_create(db, templates)
