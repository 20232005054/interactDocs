from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from db.models import StructureTemplate
from db.mappers.structure_template_mapper import StructureTemplateMapper
from services.summary_template_service import SummaryTemplateService
from db.models import Document
from typing import Dict
import re


class StructureTemplateService:
    @staticmethod
    async def get_by_id(db: AsyncSession, structure_template_id: UUID):
        return await StructureTemplateMapper.get_by_id(db, structure_template_id)

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        return await StructureTemplateMapper.get_by_template_id(db, template_id)

    @staticmethod
    async def get_root_by_template_id(db: AsyncSession, template_id: UUID):
        return await StructureTemplateMapper.get_root_by_template_id(db, template_id)

    @staticmethod
    async def get_children_by_parent_id(db: AsyncSession, parent_id: UUID):
        return await StructureTemplateMapper.get_children_by_parent_id(db, parent_id)

    @staticmethod
    async def create(
        db: AsyncSession,
        template_id: UUID,
        title: str,
        level: int,
        parent_id: UUID = None,
        generation_mode: int = 0,
        content_template: str = None,
        sources: list = None,
        default_prompt: str = None,
        custom_prompt: str = None,
        order_index: int = None
    ):
        from uuid import uuid4 as _uuid4
        field_key = "struct_" + _uuid4().hex[:8]

        if order_index is None:
            from sqlalchemy import func, select
            result = await db.execute(
                select(func.max(StructureTemplate.order_index))
                .where(StructureTemplate.template_id == template_id)
                .where(StructureTemplate.parent_id == parent_id if parent_id else StructureTemplate.parent_id.is_(None))
            )
            max_val = result.scalar()
            order_index = (max_val + 1) if max_val is not None else 0

        structure_template = StructureTemplate(
            template_id=template_id,
            parent_id=parent_id,
            title=title,
            field_key=field_key,
            level=level,
            generation_mode=generation_mode,
            content_template=content_template,
            sources=sources,
            default_prompt=default_prompt,
            custom_prompt=custom_prompt,
            order_index=order_index
        )
        return await StructureTemplateMapper.create(db, structure_template)


    @staticmethod
    async def update(db: AsyncSession, structure_template_id: UUID, **kwargs):
        if "parent_id" in kwargs and kwargs["parent_id"] is not None:
            # 防环校验
            if str(kwargs["parent_id"]) == str(structure_template_id):
                raise ValueError("父节点不能是自己")
        return await StructureTemplateMapper.update(db, structure_template_id, kwargs)

    @staticmethod
    async def delete(db: AsyncSession, structure_template_id: UUID):
        node = await StructureTemplateMapper.get_by_id(db, structure_template_id)
        if not node:
            return
        deleted_index = node.order_index
        template_id = node.template_id
        parent_id = node.parent_id
        await StructureTemplateMapper.delete_by_id(db, structure_template_id)
        await StructureTemplateMapper.shift_order_index(
            db, template_id, parent_id, deleted_index + 1, delta=-1
        )

    @staticmethod
    async def insert_after(
        db: AsyncSession, template_id: UUID, after_id: UUID, data: dict
    ):
        """在指定节点之后插入新节点（同级），field_key 后端自动生成"""
        from uuid import uuid4 as _uuid4
        field_key = "struct_" + _uuid4().hex[:8]

        after_node = await StructureTemplateMapper.get_by_id(db, after_id)
        if not after_node:
            raise ValueError("参考节点不存在")
        insert_index = after_node.order_index + 1
        await StructureTemplateMapper.shift_order_index(
            db, template_id, after_node.parent_id, insert_index, delta=1
        )
        structure_template = StructureTemplate(
            template_id=template_id,
            parent_id=after_node.parent_id,
            order_index=insert_index,
            title=data.get("title", ""),
            field_key=field_key,
            level=data.get("level", after_node.level),
            generation_mode=data.get("generation_mode", 0),
            content_template=data.get("content_template"),
            sources=data.get("sources"),
            default_prompt=data.get("default_prompt"),
            custom_prompt=data.get("custom_prompt"),
        )
        return await StructureTemplateMapper.create(db, structure_template)

    @staticmethod
    async def reorder(
        db: AsyncSession, template_id: UUID, parent_id, ordered_ids: list
    ) -> None:
        """拖拽重排：传入同级节点新顺序 ID 列表，按下标重写 order_index，支持跨父节点移动"""
        from sqlalchemy import update as sa_update
        for idx, sid in enumerate(ordered_ids):
            node = await StructureTemplateMapper.get_by_id(db, sid)
            if not node:
                raise ValueError(f"节点 {sid} 不存在")
            values = {"order_index": idx}
            if node.parent_id != parent_id:
                values["parent_id"] = parent_id
            await db.execute(
                sa_update(StructureTemplate)
                .where(StructureTemplate.structure_template_id == sid)
                .values(**values)
            )
        await db.commit()

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[StructureTemplate]):
        return await StructureTemplateMapper.batch_create(db, templates)

    @staticmethod
    async def get_structure_tree(db: AsyncSession, template_id: UUID) -> List[dict]:
        """
        获取完整的章节结构树
        """
        all_templates = await StructureTemplateMapper.get_by_template_id(db, template_id)
        
        template_map = {t.structure_template_id: t for t in all_templates}
        
        def build_tree(parent_id=None):
            children = []
            for t in all_templates:
                if t.parent_id == parent_id:
                    node = {
                        "structure_template_id": str(t.structure_template_id),
                        "title": t.title,
                        "field_key": t.field_key,
                        "level": t.level,
                        "generation_mode": t.generation_mode,
                        "order_index": t.order_index,
                        "content_template": t.content_template,
                        "sources": t.sources,
                        "default_prompt": t.default_prompt,
                        "custom_prompt": t.custom_prompt,
                        "children": build_tree(t.structure_template_id)
                    }
                    children.append(node)
            children.sort(key=lambda x: x["order_index"])
            return children
        
        return build_tree()

    @staticmethod
    def get_generation_mode(structure_template: StructureTemplate) -> int:
        """
        获取生成方式：0=复制，1=AI总结
        """
        return structure_template.generation_mode

    @staticmethod
    def get_prompt(structure_template: StructureTemplate) -> str:
        """
        获取提示词（优先使用custom_prompt）
        """
        return structure_template.custom_prompt or structure_template.default_prompt

    @staticmethod
    async def build_sources_data_map(
        db: AsyncSession,
        document: Document,
        sources: list,
        generated_summary_map: Dict[str, str] = None,
    ) -> dict:
        """
        构建数据来源映射。
        复用 SummaryTemplateService 中的逻辑。
        """
        return await SummaryTemplateService.build_sources_data_map(
            db=db,
            document=document,
            sources=sources,
            generated_summary_map=generated_summary_map
        )

    @staticmethod
    async def render_ai_content(
        db: AsyncSession,
        document: Document,
        structure_template: StructureTemplate,
        generated_summary_map: Dict[str, str] = None,
        source_data_map: Dict[str, str] = None,
    ) -> str:
        """
        渲染AI内容。
        复用 SummaryTemplateService 中的逻辑，但传入结构模板特定的参数。
        """
        return await SummaryTemplateService.render_ai_content(
            db=db,
            document=document,
            summary_template=structure_template, # 由于两个模型的结构高度相似，这里直接传入
            generated_summary_map=generated_summary_map,
            source_data_map=source_data_map
        )
