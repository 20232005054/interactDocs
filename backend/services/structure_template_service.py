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
        order_index: int = 0
    ):
        structure_template = StructureTemplate(
            template_id=template_id,
            parent_id=parent_id,
            title=title,
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
        return await StructureTemplateMapper.delete_by_id(db, structure_template_id)

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
    def generate_content_copy_mode(content_template: str, sources: list, data_map: dict) -> str:
        """
        复制模式：根据sources中的target_field替换模板中的变量
        
        Args:
            content_template: 内容模板，如 "本研究计划纳入{{sample_size}}例受试者"
            sources: 来源信息数组，包含target_field字段
            data_map: 数据映射，key为match_key，value为实际数据
        
        Returns:
            替换后的内容
        """
        if not sources:
            return content_template
        
        result = content_template
        for source in sources:
            target_field = source.get("target_field")
            match_key = source.get("match_key")
            
            if target_field and match_key:
                value = data_map.get(match_key, "")
                result = result.replace(f"{{{{{target_field}}}}}", str(value))
        
        return result

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
