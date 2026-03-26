from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from db.models import SummaryTemplate
from db.mappers.summary_template_mapper import SummaryTemplateMapper
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
