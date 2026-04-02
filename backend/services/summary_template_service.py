from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, List
from sqlalchemy import select
from db.models import (
    SummaryTemplate,
    Document,
    DocumentCoreInfo,
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
        return await SummaryTemplateMapper.create(db, summary_template)

    @staticmethod
    async def update(db: AsyncSession, summary_template_id: UUID, **kwargs):
        return await SummaryTemplateMapper.update(db, summary_template_id, kwargs)

    @staticmethod
    async def delete(db: AsyncSession, summary_template_id: UUID):
        node = await SummaryTemplateMapper.get_by_id(db, summary_template_id)
        if not node:
            return
        deleted_index = node.order_index
        template_id = node.template_id
        await SummaryTemplateMapper.delete_by_id(db, summary_template_id)
        await SummaryTemplateMapper.shift_order_index(db, template_id, deleted_index + 1, delta=-1)

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
        return await SummaryTemplateMapper.create(db, summary_template)

    @staticmethod
    async def reorder(
        db: AsyncSession, template_id: UUID, ordered_ids: list[UUID]
    ) -> None:
        items = [
            {"summary_template_id": sid, "order_index": idx}
            for idx, sid in enumerate(ordered_ids)
        ]
        await SummaryTemplateMapper.batch_update_order(db, items)

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

        print(f"\n========== 开始生成 AI 摘要: [{summary_template.title}] ==========")
        print(f"-> 原始 sources 配置: {summary_template.sources}")

        if source_data_map is not None:
            variable_map = source_data_map
        else:
            variable_map = await SummaryTemplateService.build_sources_data_map(
                db=db,
                document=document,
                sources=summary_template.sources or [],
                generated_summary_map=generated_summary_map,
            )
            
        print(f"-> 提取到的 source_data_map: {variable_map}")
            
        # 组装纯文本提示词与来源数据
        sources_text = ""
        sources = summary_template.sources or []
        if sources:
            sources_text = "\n\n请严格结合以下参考数据进行总结和生成：\n"
            has_data = False
            for source in sources:
                target_field = source.get("target_field")
                if not target_field:
                    continue
                
                # 尝试获取友好的 label
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

        # 兼容可能有 {{}} 的旧版模板，同时也拼接了新的参考数据
        base_prompt = SummaryTemplateService.render_template_variables(
            prompt_template, variable_map
        )
        # 将摘要的标题作为上下文一部分拼接进去
        title_context = f"当前需要生成的摘要/内容模块名称为：【{summary_template.title}】\n"

        # 构建核心信息结构化背景文本
        core_info_background = ""
        try:
            structured_text = await SummaryTemplateService._get_core_info_structured_text(
                db, document.document_id
            )
            if structured_text:
                core_info_background = f"\n\n【文档核心信息背景】\n{structured_text}\n"
        except Exception:
            pass  # 背景信息获取失败不影响主流程

        final_prompt = f"{title_context}{base_prompt}{core_info_background}{sources_text}"
        
        print(f"-> 最终构建的 AI 提示词 (final_prompt):\n{final_prompt}")

        template_id = getattr(
            summary_template,
            "summary_template_id",
            getattr(summary_template, "structure_template_id", None),
        )
        
        content = await SummaryTemplateService._call_ai_renderer(
            final_prompt,
            template_id=str(template_id) if template_id else None,
            field_key=getattr(summary_template, "field_key", None),
        )
        
        print(f"-> AI 生成的内容结果:\n{content}\n========================================================\n")
        return content

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
        return {info.field_key: info.content for info in core_infos if info.field_key}

    @staticmethod
    async def _get_core_info_structured_text(db: AsyncSession, document_id: UUID) -> str:
        """
        将文档核心信息按树形分组结构转成带缩进的文本块，用于 AI prompt 背景上下文。
        group 节点作为标题行，叶子节点输出 "字段名：内容"，跳过内容为空的节点。

        示例输出：
            试验基本信息：
              试验名称：一项评估XX药物治疗晚期肺癌的III期临床试验
              申办方：XX制药有限公司
              研究阶段：III期
            试验设计信息：
              研究目的：评估XX药物对比安慰剂的疗效
              样本量：300
        """
        result = await db.execute(
            select(DocumentCoreInfo)
            .where(DocumentCoreInfo.document_id == document_id)
            .order_by(DocumentCoreInfo.order_index)
        )
        all_nodes = result.scalars().all()
        if not all_nodes:
            return ""

        # 构建 id → node 映射
        node_map = {n.core_info_id: n for n in all_nodes}

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
        # 现在 summaries 已经有了 field_key 字段，可以直接映射
        summary_map = {summary.field_key: summary.content for summary in summaries}
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
