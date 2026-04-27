from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional, Dict
from db.models import StructureTemplate, Document
from db.mappers.structure_template_mapper import StructureTemplateMapper
from services.template_render_service import TemplateRenderService


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
        order_index: int = None,
        paragraphs: list = None,
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
            order_index=order_index,
            paragraphs=paragraphs,
        )
        result = await StructureTemplateMapper.create(db, structure_template)
        await db.commit()
        return result

    @staticmethod
    async def update(db: AsyncSession, structure_template_id: UUID, **kwargs):
        if "parent_id" in kwargs and kwargs["parent_id"] is not None:
            if str(kwargs["parent_id"]) == str(structure_template_id):
                raise ValueError("父节点不能是自己")
        await StructureTemplateMapper.update(db, structure_template_id, kwargs)
        await db.commit()
        return await StructureTemplateMapper.get_by_id(db, structure_template_id)

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
        await db.commit()

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
            paragraphs=data.get("paragraphs"),
        )
        result = await StructureTemplateMapper.create(db, structure_template)
        await db.commit()
        return result

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
        result = await StructureTemplateMapper.batch_create(db, templates)
        await db.commit()
        return result

    @staticmethod
    async def get_structure_tree(db: AsyncSession, template_id: UUID) -> List[dict]:
        """获取完整的章节结构树"""
        all_templates = await StructureTemplateMapper.get_by_template_id(db, template_id)

        def build_tree(parent_id=None):
            children = []
            for t in all_templates:
                if t.parent_id == parent_id:
                    node = {
                        "structure_template_id": t.structure_template_id,
                        "template_id": t.template_id,
                        "title": t.title,
                        "field_key": t.field_key,
                        "level": t.level,
                        "order_index": t.order_index,
                        "paragraphs": t.paragraphs,
                        "children": build_tree(t.structure_template_id),
                    }
                    children.append(node)
            children.sort(key=lambda x: x["order_index"])
            return children

        return build_tree()

    @staticmethod
    async def build_sources_data_map(
        db: AsyncSession,
        document: Document,
        sources: list,
        generated_summary_map: Dict[str, str] = None,
    ) -> dict:
        return await TemplateRenderService.build_sources_data_map(
            db=db, document=document, sources=sources,
            generated_summary_map=generated_summary_map,
        )

    @staticmethod
    async def render_ai_content_for_paragraph(
        db: AsyncSession,
        document: Document,
        chapter_title: str,
        para_def: dict,
        field_key: str,
        template_id: str,
        source_data_map: Dict[str, str] = None,
    ) -> str:
        """为单个段落定义调用 AI 生成内容"""
        prompt = para_def.get("custom_prompt") or para_def.get("default_prompt")
        draft = para_def.get("content_template") if para_def.get("generation_mode") == 3 else None
        return await TemplateRenderService.render_ai_content(
            db=db,
            document=document,
            title=chapter_title,
            sources=para_def.get("sources"),
            prompt=prompt,
            field_key=field_key,
            template_id=template_id,
            source_data_map=source_data_map,
            draft=draft,
        )

    @staticmethod
    async def render_ai_content_for_paragraph_with_citations(
        db: AsyncSession,
        document: Document,
        chapter_title: str,
        para_def: dict,
        field_key: str,
        template_id: str,
        source_data_map: Dict[str, str] = None,
    ) -> tuple:
        """为单个段落定义调用 AI 生成内容，同时返回文献引用列表。
        Returns: (content: str, citations: list)
        """
        prompt = para_def.get("custom_prompt") or para_def.get("default_prompt")
        draft = para_def.get("content_template") if para_def.get("generation_mode") == 3 else None
        return await TemplateRenderService.render_ai_content_with_citations(
            db=db,
            document=document,
            title=chapter_title,
            sources=para_def.get("sources"),
            prompt=prompt,
            field_key=field_key,
            template_id=template_id,
            source_data_map=source_data_map,
            draft=draft,
        )
