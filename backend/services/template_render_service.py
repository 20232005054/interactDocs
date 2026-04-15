"""
模板渲染公共服务

提供 SummaryTemplate 和 StructureTemplate 共用的渲染逻辑：
- build_sources_data_map：根据 sources 配置从数据库取值，构建变量映射
- render_ai_content：调用 AI 生成内容
- generate_content_copy_mode：复制模式变量替换
- render_template_variables：正则替换 {{var}} 变量
"""

import re
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Document, DocumentCoreInfo, Paragraph
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.chapter_mapper import ChapterMapper
from services.ai_client import call_qwen_once


class TemplateRenderService:

    # ------------------------------------------------------------------
    # 变量替换
    # ------------------------------------------------------------------

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
        if not content_template:
            return ""
        if not sources:
            return TemplateRenderService.render_template_variables(content_template, data_map)

        variable_map = {}
        for source in sources:
            target_field = source.get("target_field")
            match_key = source.get("match_key")
            if not target_field:
                continue
            variable_map[target_field] = data_map.get(target_field, data_map.get(match_key, ""))
        merged_map = {**data_map, **variable_map}
        return TemplateRenderService.render_template_variables(content_template, merged_map)

    # ------------------------------------------------------------------
    # 数据来源映射构建
    # ------------------------------------------------------------------

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
            source_obj = source.get("source")
            source_type = source_obj.get("value") if isinstance(source_obj, dict) else None
            match_keys = source.get("match_keys") or []

            target_field = source.get("target_field")
            if not target_field:
                continue

            values = []
            for mk in match_keys:
                match_key = mk.get("value") if isinstance(mk, dict) else None
                if not match_key:
                    continue

                value = ""
                if source_type == "keyinfo":
                    if core_info_map is None:
                        core_info_map = await TemplateRenderService._get_core_info_map(db, document.document_id)
                    value = core_info_map.get(match_key, "")
                elif source_type == "summary":
                    if summary_map is None:
                        summary_map = await TemplateRenderService._get_summary_content_map(db, document)
                    merged_summary_map = {**summary_map, **generated_summary_map}
                    value = merged_summary_map.get(match_key, "")
                elif source_type == "chapter":
                    if chapter_map is None:
                        chapter_map = await TemplateRenderService._get_chapter_content_map(db, document)
                    value = chapter_map.get(match_key, "")

                if value:
                    values.append(str(value))
                    if match_key not in data_map:
                        data_map[match_key] = value

            data_map[target_field] = "\n".join(values)

        return data_map

    # ------------------------------------------------------------------
    # AI 内容渲染
    # ------------------------------------------------------------------

    @staticmethod
    async def render_ai_content(
        db: AsyncSession,
        document: Document,
        title: str,
        sources: list,
        prompt: str,
        field_key: str = None,
        template_id: str = None,
        generated_summary_map: Dict[str, str] = None,
        source_data_map: Dict[str, str] = None,
        draft: str = None,
    ) -> str:
        if not prompt and not draft:
            return ""

        print(f"\n========== 开始生成 AI 内容: [{title}] ==========")
        print(f"-> 原始 sources 配置: {sources}")

        if source_data_map is not None:
            variable_map = source_data_map
        else:
            variable_map = await TemplateRenderService.build_sources_data_map(
                db=db,
                document=document,
                sources=sources or [],
                generated_summary_map=generated_summary_map,
            )

        print(f"-> 提取到的 source_data_map: {variable_map}")

        sources_text = ""
        if sources:
            sources_text = "\n\n请严格结合以下参考数据进行总结和生成：\n"
            has_data = False
            for source in sources:
                target_field = source.get("target_field")
                if not target_field:
                    continue
                label = target_field
                match_keys = source.get("match_keys")
                if match_keys and isinstance(match_keys, list) and len(match_keys) > 0:
                    first_mk = match_keys[0]
                    if isinstance(first_mk, dict) and first_mk.get("label"):
                        label = first_mk.get("label")
                value = variable_map.get(target_field)
                if value and str(value).strip():
                    sources_text += f"【{label}】:\n{value}\n\n"
                    has_data = True
            if not has_data:
                sources_text = ""

        base_prompt = TemplateRenderService.render_template_variables(prompt or "", variable_map)
        title_context = f"当前需要生成的摘要/内容模块名称为：【{title}】\n"

        # mode 3：草稿润色，把草稿拼入 prompt
        draft_context = ""
        if draft and draft.strip():
            draft_context = f"\n\n【当前草稿内容】\n{draft.strip()}\n请在以上草稿基础上进行修改完善，使其更专业、更符合临床研究规范。\n"

        core_info_background = ""
        try:
            structured_text = await TemplateRenderService._get_core_info_structured_text(db, document.document_id)
            if structured_text:
                core_info_background = f"\n\n【文档核心信息背景】\n{structured_text}\n"
        except Exception:
            pass

        final_prompt = f"{title_context}{base_prompt}{draft_context}{core_info_background}{sources_text}"
        print(f"-> 最终构建的 AI 提示词 (final_prompt):\n{final_prompt}")

        content = await TemplateRenderService._call_ai_renderer(
            final_prompt, template_id=template_id, field_key=field_key
        )
        print(f"-> AI 生成的内容结果:\n{content}\n========================================================\n")
        return content

    @staticmethod
    async def _call_ai_renderer(prompt: str, template_id: str = None, field_key: str = None) -> str:
        result = await call_qwen_once(
            "你是一位专业的临床研究文档写作专家。",
            [],
            prompt,
            template_id=template_id,
            field_key=field_key,
        )
        return result["content"]

    # ------------------------------------------------------------------
    # 私有数据查询辅助
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()
        return {info.field_key: info.content for info in core_infos if info.field_key}

    @staticmethod
    async def _get_core_info_structured_text(db: AsyncSession, document_id: UUID) -> str:
        result = await db.execute(
            select(DocumentCoreInfo)
            .where(DocumentCoreInfo.document_id == document_id)
            .order_by(DocumentCoreInfo.order_index)
        )
        all_nodes = result.scalars().all()
        if not all_nodes:
            return ""

        def build_text(parent_id, indent: int) -> str:
            lines = []
            children = [n for n in all_nodes if n.parent_id == parent_id]
            children.sort(key=lambda x: x.order_index)
            prefix = "  " * indent
            for node in children:
                if node.field_type == "group":
                    lines.append(f"{prefix}{node.title}：")
                    lines.append(build_text(node.core_info_id, indent + 1))
                else:
                    if node.content and node.content.strip():
                        lines.append(f"{prefix}{node.title}：{node.content.strip()}")
            return "\n".join(filter(None, lines))

        return build_text(None, 0)

    @staticmethod
    async def _get_summary_content_map(db: AsyncSession, document: Document) -> dict:
        summaries = await SummaryMapper.get_summaries_by_document_id(db, document.document_id)
        return {s.field_key: s.content for s in summaries}

    @staticmethod
    async def _get_chapter_content_map(db: AsyncSession, document: Document) -> dict:
        chapters = await ChapterMapper.get_chapters_by_document_id(db, document.document_id)
        if not chapters:
            return {}
        chapter_id_list = [c.chapter_id for c in chapters]
        paragraph_result = await db.execute(
            select(Paragraph)
            .where(Paragraph.chapter_id.in_(chapter_id_list))
            .order_by(Paragraph.chapter_id, Paragraph.order_index)
        )
        paragraphs = paragraph_result.scalars().all()
        chapter_content_by_id = {}
        for p in paragraphs:
            chapter_content_by_id.setdefault(p.chapter_id, []).append(p.content)

        title_map = {}
        for chapter in chapters:
            content = "\n".join(chapter_content_by_id.get(chapter.chapter_id, [])).strip()
            title_map[chapter.title] = content

        structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
        chapter_map = dict(title_map)
        for tmpl in structure_templates:
            chapter_map[tmpl.field_key] = title_map.get(tmpl.title, "")
        return chapter_map
