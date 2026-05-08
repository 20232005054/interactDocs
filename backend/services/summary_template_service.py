from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, List
from db.models import SummaryTemplate, Document
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from services.template_render_service import TemplateRenderService


class SummaryTemplateService:
    @staticmethod
    async def get_by_id(db: AsyncSession, summary_template_id: UUID):
        return await SummaryTemplateMapper.get_by_id(db, summary_template_id)

    @staticmethod
    async def get_by_template_id(db: AsyncSession, template_id: UUID):
        return await SummaryTemplateMapper.get_by_template_id(db, template_id)

    @staticmethod
    async def create(
        db: AsyncSession,
        template_id: UUID,
        title: str,
        generation_mode: int = 0,
        content_template: str = None,
        sources: list = None,
        default_prompt: str = None,
        custom_prompt: str = None,
        order_index: int = None
    ):
        from uuid import uuid4 as _uuid4
        field_key = "summary_" + _uuid4().hex[:8]

        if order_index is None:
            max_idx = await SummaryTemplateMapper.get_max_order_index(db, template_id)
            order_index = max_idx + 1
        else:
            await SummaryTemplateMapper.shift_order_index(db, template_id, order_index, delta=1)
        summary_template = SummaryTemplate(
            template_id=template_id,
            title=title,
            field_key=field_key,
            generation_mode=generation_mode,
            content_template=content_template,
            sources=sources,
            default_prompt=default_prompt,
            custom_prompt=custom_prompt,
            order_index=order_index
        )
        result = await SummaryTemplateMapper.create(db, summary_template)
        await db.commit()
        return result

    @staticmethod
    async def update(db: AsyncSession, summary_template_id: UUID, **kwargs):
        await SummaryTemplateMapper.update(db, summary_template_id, kwargs)
        await db.commit()
        return await SummaryTemplateMapper.get_by_id(db, summary_template_id)

    @staticmethod
    async def delete(db: AsyncSession, summary_template_id: UUID):
        node = await SummaryTemplateMapper.get_by_id(db, summary_template_id)
        if not node:
            return
        deleted_index = node.order_index
        template_id = node.template_id
        await SummaryTemplateMapper.delete_by_id(db, summary_template_id)
        await SummaryTemplateMapper.shift_order_index(db, template_id, deleted_index + 1, delta=-1)
        await db.commit()

    @staticmethod
    async def insert_after(
        db: AsyncSession, template_id: UUID, after_id: UUID, data: dict
    ):
        from uuid import uuid4 as _uuid4
        field_key = "summary_" + _uuid4().hex[:8]

        after_node = await SummaryTemplateMapper.get_by_id(db, after_id)
        if not after_node:
            raise ValueError("参考节点不存在")
        insert_index = after_node.order_index + 1
        await SummaryTemplateMapper.shift_order_index(db, template_id, insert_index, delta=1)
        summary_template = SummaryTemplate(
            template_id=template_id,
            order_index=insert_index,
            field_key=field_key,
            title=data.get("title", ""),
            generation_mode=data.get("generation_mode", 0),
            content_template=data.get("content_template"),
            sources=data.get("sources"),
            default_prompt=data.get("default_prompt"),
            custom_prompt=data.get("custom_prompt"),
        )
        result = await SummaryTemplateMapper.create(db, summary_template)
        await db.commit()
        return result

    @staticmethod
    async def reorder(
        db: AsyncSession, template_id: UUID, ordered_ids: list[UUID]
    ) -> None:
        items = [
            {"summary_template_id": sid, "order_index": idx}
            for idx, sid in enumerate(ordered_ids)
        ]
        await SummaryTemplateMapper.batch_update_order(db, items)
        await db.commit()

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[SummaryTemplate]):
        result = await SummaryTemplateMapper.batch_create(db, templates)
        await db.commit()
        return result

    @staticmethod
    def render_template_variables(template_text: str, variables: dict) -> str:
        return TemplateRenderService.render_template_variables(template_text, variables)

    @staticmethod
    def generate_content_copy_mode(content_template: str, sources: list, data_map: dict) -> str:
        return TemplateRenderService.generate_content_copy_mode(content_template, sources, data_map)

    @staticmethod
    def get_generation_mode(summary_template: SummaryTemplate) -> int:
        return summary_template.generation_mode

    @staticmethod
    def get_prompt(summary_template: SummaryTemplate) -> str:
        return summary_template.custom_prompt or summary_template.default_prompt

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
    async def render_ai_content(
        db: AsyncSession,
        document: Document,
        summary_template: SummaryTemplate,
        generated_summary_map: Dict[str, str] = None,
        source_data_map: Dict[str, str] = None,
        draft: str = None,
    ) -> str:
        template_id = getattr(
            summary_template, "summary_template_id",
            getattr(summary_template, "structure_template_id", None),
        )
        return await TemplateRenderService.render_ai_content(
            db=db,
            document=document,
            title=summary_template.title,
            sources=summary_template.sources,
            prompt=summary_template.custom_prompt or summary_template.default_prompt,
            field_key=getattr(summary_template, "field_key", None),
            template_id=str(template_id) if template_id else None,
            generated_summary_map=generated_summary_map,
            source_data_map=source_data_map,
            draft=draft,
            generation_mode=summary_template.generation_mode,  # 传入 generation_mode
        )

    @staticmethod
    async def render_ai_content_with_citations(
        db: AsyncSession,
        document: Document,
        summary_template: SummaryTemplate,
        generated_summary_map: Dict[str, str] = None,
        source_data_map: Dict[str, str] = None,
        draft: str = None,
    ) -> tuple:
        """返回 (content, citations)"""
        template_id = getattr(
            summary_template, "summary_template_id",
            getattr(summary_template, "structure_template_id", None),
        )
        return await TemplateRenderService.render_ai_content_with_citations(
            db=db,
            document=document,
            title=summary_template.title,
            sources=summary_template.sources,
            prompt=summary_template.custom_prompt or summary_template.default_prompt,
            field_key=getattr(summary_template, "field_key", None),
            template_id=str(template_id) if template_id else None,
            generated_summary_map=generated_summary_map,
            source_data_map=source_data_map,
            draft=draft,
            generation_mode=summary_template.generation_mode,  # 传入 generation_mode
        )

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        return await TemplateRenderService._get_core_info_map(db, document_id)

    @staticmethod
    async def _get_core_info_structured_text(db: AsyncSession, document_id: UUID) -> str:
        """获取核心信息结构化文本（统一入口）"""
        from services.ai_context_builder import AIContextBuilder
        return await AIContextBuilder.get_core_info_structured_text(db, document_id)

    @staticmethod
    async def _get_summary_content_map(db: AsyncSession, document: Document) -> dict:
        return await TemplateRenderService._get_summary_content_map(db, document)

    @staticmethod
    async def _get_chapter_content_map(db: AsyncSession, document: Document) -> dict:
        return await TemplateRenderService._get_chapter_content_map(db, document)
