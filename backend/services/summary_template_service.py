from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, List
from sqlalchemy import select
from db.models import (
    SummaryTemplate,
    Document,
    DocumentCoreInfo,
    CoreInfoTemplate,
    Paragraph,
)
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper as SummaryTemplateDbMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.chapter_mapper import ChapterMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from services.ai_client import call_qwen_once
import re


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
        order_index: int = 0
    ):
        summary_template = SummaryTemplate(
            template_id=template_id,
            title=title,
            generation_mode=generation_mode,
            content_template=content_template,
            sources=sources,
            default_prompt=default_prompt,
            custom_prompt=custom_prompt,
            order_index=order_index
        )
        return await SummaryTemplateMapper.create(db, summary_template)

    @staticmethod
    async def update(db: AsyncSession, summary_template_id: UUID, **kwargs):
        return await SummaryTemplateMapper.update(db, summary_template_id, kwargs)

    @staticmethod
    async def delete(db: AsyncSession, summary_template_id: UUID):
        return await SummaryTemplateMapper.delete_by_id(db, summary_template_id)

    @staticmethod
    async def batch_create(db: AsyncSession, templates: List[SummaryTemplate]):
        return await SummaryTemplateMapper.batch_create(db, templates)

    @staticmethod
    def render_template_variables(template_text: str, variables: dict) -> str:
        if not template_text:
            return ""
        safe_variables = variables or {}
        pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

        def replacer(match):
            key = match.group(1)
            return str(safe_variables.get(key, ""))

        return pattern.sub(replacer, template_text)

    @staticmethod
    def generate_content_copy_mode(content_template: str, sources: list, data_map: dict) -> str:
        """
        复制模式：根据sources中的target_field替换模板中的变量
        
        Args:
            content_template: 内容模板，如 "本试验名称为{{trial_name}}，由{{sponsor}}申办"
            sources: 来源信息数组，包含target_field字段
            data_map: 数据映射，key为match_key，value为实际数据
        
        Returns:
            替换后的内容
        """
        if not content_template:
            return ""
        if not sources:
            return SummaryTemplateService.render_template_variables(content_template, data_map)

        variable_map = {}
        for source in sources:
            target_field = source.get("target_field")
            match_key = source.get("match_key")
            if not target_field:
                continue
            variable_map[target_field] = data_map.get(target_field, data_map.get(match_key, ""))
        merged_map = {**data_map, **variable_map}
        return SummaryTemplateService.render_template_variables(content_template, merged_map)

    @staticmethod
    def get_generation_mode(summary_template: SummaryTemplate) -> int:
        """
        获取生成方式：0=复制，1=AI总结
        """
        return summary_template.generation_mode

    @staticmethod
    def get_prompt(summary_template: SummaryTemplate) -> str:
        """
        获取提示词（优先使用custom_prompt）
        """
        return summary_template.custom_prompt or summary_template.default_prompt

    @staticmethod
    async def build_sources_data_map(
        db: AsyncSession,
        document: Document,
        sources: list,
        generated_summary_map: Dict[str, str] = None,
    ) -> dict:
        if not sources:
            return {}

        generated_summary_map = generated_summary_map or {}
        data_map = {}

        core_info_map = None
        summary_map = None
        chapter_map = None

        for source in sources:
            # 兼容旧结构和新结构
            source_obj = source.get("source")
            source_type = source_obj.get("value") if isinstance(source_obj, dict) else source_obj
            
            # 兼容旧的 match_key 和新的 match_keys
            match_keys_data = source.get("match_keys")
            if not match_keys_data:
                old_match_key = source.get("match_key")
                match_keys = [{"value": old_match_key}] if old_match_key else []
            else:
                match_keys = match_keys_data

            target_field = source.get("target_field")
            if not target_field:
                continue

            values = []
            for mk in match_keys:
                match_key = mk.get("value") if isinstance(mk, dict) else mk
                if not match_key:
                    continue

                value = ""
                if source_type == "keyinfo":
                    if core_info_map is None:
                        core_info_map = await SummaryTemplateService._get_core_info_map(db, document.document_id)
                    value = core_info_map.get(match_key, "")
                elif source_type == "summary":
                    if summary_map is None:
                        summary_map = await SummaryTemplateService._get_summary_content_map(
                            db, document
                        )
                    merged_summary_map = {**summary_map, **generated_summary_map}
                    value = merged_summary_map.get(match_key, "")
                elif source_type == "chapter":
                    if chapter_map is None:
                        chapter_map = await SummaryTemplateService._get_chapter_content_map(
                            db, document
                        )
                    value = chapter_map.get(match_key, "")

                if value:
                    values.append(str(value))
                    # 将单个 key 也存入 data_map 以支持旧的模板变量
                    if match_key not in data_map:
                        data_map[match_key] = value

            # 将多个来源的内容合并存入 target_field
            data_map[target_field] = "\n".join(values)

        return data_map

    @staticmethod
    async def render_ai_content(
        db: AsyncSession,
        document: Document,
        summary_template: SummaryTemplate,
        generated_summary_map: Dict[str, str] = None,
        source_data_map: Dict[str, str] = None,
    ) -> str:
        prompt_template = SummaryTemplateService.get_prompt(summary_template)
        if not prompt_template:
            return ""

        if source_data_map is not None:
            variable_map = source_data_map
        else:
            variable_map = await SummaryTemplateService.build_sources_data_map(
                db=db,
                document=document,
                sources=summary_template.sources or [],
                generated_summary_map=generated_summary_map,
            )
        final_prompt = SummaryTemplateService.render_template_variables(
            prompt_template, variable_map
        )
        template_id = getattr(
            summary_template,
            "summary_template_id",
            getattr(summary_template, "structure_template_id", None),
        )
        return await SummaryTemplateService._call_ai_renderer(
            final_prompt,
            template_id=str(template_id) if template_id else None,
            field_key=getattr(summary_template, "field_key", None),
        )

    @staticmethod
    async def _call_ai_renderer(
        prompt: str,
        template_id: str = None,
        field_key: str = None,
    ) -> str:
        result = await call_qwen_once(
            "你是一位专业的临床研究文档写作专家。",
            [],
            prompt,
            template_id=template_id,
            field_key=field_key,
        )
        return result["content"]

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()

        template_result = await db.execute(
            select(CoreInfoTemplate)
            .join(DocumentCoreInfo, CoreInfoTemplate.field_name == DocumentCoreInfo.title)
            .where(DocumentCoreInfo.document_id == document_id)
        )
        templates = template_result.scalars().all()
        template_map = {t.field_name: t.field_key for t in templates}

        core_info_map = {}
        for info in core_infos:
            field_key = template_map.get(info.title, info.title)
            core_info_map[field_key] = info.content
        return core_info_map

    @staticmethod
    async def _get_summary_content_map(db: AsyncSession, document: Document) -> dict:
        summaries = await SummaryMapper.get_summaries_by_document_id(db, document.document_id)
        title_to_content = {summary.title: summary.content for summary in summaries}
        summary_templates = await SummaryTemplateDbMapper.get_by_template_id(db, document.template_id)

        summary_map = {}
        for template in summary_templates:
            summary_map[template.field_key] = title_to_content.get(template.title, "")
        return summary_map

    @staticmethod
    async def _get_chapter_content_map(db: AsyncSession, document: Document) -> dict:
        chapters = await ChapterMapper.get_chapters_by_document_id(db, document.document_id)
        if not chapters:
            return {}
        chapter_id_list = [chapter.chapter_id for chapter in chapters]
        paragraph_result = await db.execute(
            select(Paragraph)
            .where(Paragraph.chapter_id.in_(chapter_id_list))
            .order_by(Paragraph.chapter_id, Paragraph.order_index)
        )
        paragraphs = paragraph_result.scalars().all()
        chapter_content_by_id = {}
        for paragraph in paragraphs:
            chapter_content_by_id.setdefault(paragraph.chapter_id, []).append(paragraph.content)

        title_map = {}
        for chapter in chapters:
            content = "\n".join(chapter_content_by_id.get(chapter.chapter_id, [])).strip()
            title_map[chapter.title] = content

        structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
        chapter_map = dict(title_map)
        for template in structure_templates:
            chapter_map[template.field_key] = title_map.get(template.title, "")
        return chapter_map
