"""
模板渲染公共服务

提供 SummaryTemplate 和 StructureTemplate 共用的渲染逻辑：
- build_sources_data_map：根据 sources 配置从数据库取值，构建变量映射
- render_ai_content：调用 AI 生成内容（已迁移到 LangChain）
- generate_content_copy_mode：复制模式变量替换（已废弃，由 TemplateRenderChain 处理）
- render_template_variables：正则替换 {{var}} 变量（已废弃，由 TemplateRenderChain 处理）
"""

import logging
import re
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Document, DocumentCoreInfo, Paragraph
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.chapter_mapper import ChapterMapper
from services.ai_context_builder import AIContextBuilder
from services.langchain.chains.template_render_chain import create_template_render_chain

logger = logging.getLogger(__name__)


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
        return TemplateRenderService.render_template_variables(content_template, data_map)

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
                    data_map[match_key] = value

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
        generation_mode: int = 1,  # 默认 AI 生成模式
    ) -> str:
        """
        渲染 AI 内容（已迁移到 LangChain TemplateRenderChain）
        
        Args:
            db: 数据库会话
            document: 文档对象
            title: 标题
            sources: 来源配置
            prompt: AI 提示词
            field_key: 字段 key
            template_id: 模板 ID
            generated_summary_map: 已生成的摘要映射
            source_data_map: 来源数据映射（可选，不传则自动构建）
            draft: 草稿内容（mode=3 时使用）
            generation_mode: 生成模式（默认 1=AI生成）
        
        Returns:
            生成的内容
        """
        logger.info(
            f"[模板渲染] 开始 title={title} mode={generation_mode} "
            f"template_id={template_id} field_key={field_key}"
        )
        
        # 构建变量映射
        if source_data_map is not None:
            variable_map = source_data_map
        else:
            variable_map = await TemplateRenderService.build_sources_data_map(
                db=db,
                document=document,
                sources=sources or [],
                generated_summary_map=generated_summary_map,
            )
        
        # 获取核心信息背景
        core_info_background = ""
        try:
            structured_text = await AIContextBuilder.get_core_info_structured_text(
                db, document.document_id
            )
            if structured_text:
                core_info_background = f"【文档核心信息背景】\n{structured_text}"
        except Exception as e:
            logger.warning(f"获取核心信息背景失败: {e}")
        
        # 文献 RAG 注入
        literature_context, literature_citations = await AIContextBuilder.inject_literature_context(
            db=db,
            document=document,
            query=f"{title} {prompt}",
            paragraph_id=None,  # 模板级检索
            top_k=5,
        )
        
        # 调用 TemplateRenderChain
        chain = create_template_render_chain()
        content, citation_indices = await chain.render(
            generation_mode=generation_mode,
            title=title,
            content_template=draft if generation_mode == 3 else None,
            sources=sources,
            prompt=prompt,
            variable_map=variable_map,
            core_info_background=core_info_background,
            literature_context=literature_context,
            draft=draft,
            template_id=template_id,
            field_key=field_key,
        )
        
        logger.info(
            f"[模板渲染] 完成 title={title} "
            f"content_length={len(content)} citations={len(citation_indices)}"
        )
        
        return content

    @staticmethod
    async def render_ai_content_with_citations(
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
        generation_mode: int = 1,
    ) -> Tuple[str, list]:
        """
        渲染 AI 内容并返回文献引用列表（已迁移到 LangChain）
        
        Returns:
            (content, citations)
        """
        logger.info(
            f"[模板渲染+引用] 开始 title={title} mode={generation_mode} "
            f"template_id={template_id} field_key={field_key}"
        )
        
        # 构建变量映射
        if source_data_map is not None:
            variable_map = source_data_map
        else:
            variable_map = await TemplateRenderService.build_sources_data_map(
                db=db,
                document=document,
                sources=sources or [],
                generated_summary_map=generated_summary_map,
            )
        
        # 获取核心信息背景
        core_info_background = ""
        try:
            structured_text = await AIContextBuilder.get_core_info_structured_text(
                db, document.document_id
            )
            if structured_text:
                core_info_background = f"【文档核心信息背景】\n{structured_text}"
        except Exception as e:
            logger.warning(f"获取核心信息背景失败: {e}")
        
        # 文献 RAG 注入
        literature_context, literature_citations = await AIContextBuilder.inject_literature_context(
            db=db,
            document=document,
            query=f"{title} {prompt}",
            paragraph_id=None,
            top_k=5,
        )
        
        # 调用 TemplateRenderChain
        chain = create_template_render_chain()
        content, citation_indices = await chain.render(
            generation_mode=generation_mode,
            title=title,
            content_template=draft if generation_mode == 3 else None,
            sources=sources,
            prompt=prompt,
            variable_map=variable_map,
            core_info_background=core_info_background,
            literature_context=literature_context,
            draft=draft,
            template_id=template_id,
            field_key=field_key,
        )
        
        logger.info(
            f"[模板渲染+引用] 完成 title={title} "
            f"content_length={len(content)} citations={len(literature_citations)}"
        )
        
        return content, literature_citations

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
