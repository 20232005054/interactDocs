from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.models import SummaryTitleTemplate

class SummaryTitleTemplateMapper:
    @staticmethod
    async def create_template(db: AsyncSession, template):
        """
        创建摘要标题模板
        """
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def get_template_by_id(db: AsyncSession, template_id: UUID):
        """
        根据ID获取摘要标题模板
        """
        result = await db.execute(
            select(SummaryTitleTemplate).where(SummaryTitleTemplate.template_id == template_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_template_by_purpose(db: AsyncSession, purpose: str):
        """
        根据用途获取摘要标题模板
        """
        result = await db.execute(
            select(SummaryTitleTemplate).where(SummaryTitleTemplate.purpose == purpose)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_all_templates(db: AsyncSession):
        """
        获取所有摘要标题模板
        """
        result = await db.execute(select(SummaryTitleTemplate))
        return result.scalars().all()
    
    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, update_data):
        """
        更新摘要标题模板
        """
        template = await SummaryTitleTemplateMapper.get_template_by_id(db, template_id)
        if not template:
            return None
        for key, value in update_data.items():
            if hasattr(template, key):
                setattr(template, key, value)
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def delete_template(db: AsyncSession, template_id: UUID):
        """
        删除摘要标题模板
        """
        template = await SummaryTitleTemplateMapper.get_template_by_id(db, template_id)
        if not template:
            return False
        await db.delete(template)
        await db.commit()
        return True
