from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Template
from uuid import UUID

class TemplateMapper:
    @staticmethod
    async def get_template(db: AsyncSession, template_id: UUID):
        """
        获取模板详情
        """
        result = await db.execute(
            select(Template).where(Template.template_id == template_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_template(db: AsyncSession, template):
        """
        创建模板
        """
        db.add(template)
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, update_data):
        """
        更新模板
        """
        from sqlalchemy import update
        await db.execute(
            update(Template)
            .where(Template.template_id == template_id)
            .values(**update_data)
        )
        await db.commit()
    
    @staticmethod
    async def delete_template(db: AsyncSession, template):
        """
        删除模板
        """
        await db.delete(template)
        await db.commit()
    
    @staticmethod
    async def list_templates(db: AsyncSession, purpose: str = None, is_system: bool = None, is_active: bool = None):
        """
        获取模板列表
        """
        query = select(Template).order_by(Template.updated_at.desc())
        if purpose:
            query = query.where(Template.purpose == purpose)
        if is_system is not None:
            query = query.where(Template.is_system == is_system)
        if is_active is not None:
            query = query.where(Template.is_active == is_active)
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def get_distinct_purposes(db: AsyncSession, is_system: bool = True):
        """
        获取所有不同的用途
        """
        query = select(Template.purpose).distinct()
        if is_system is not None:
            query = query.where(Template.is_system == is_system)
        result = await db.execute(query)
        return [row[0] for row in result.all()]
    
    @staticmethod
    async def get_templates_by_purpose(db: AsyncSession, purpose: str, is_system: bool = None, is_active: bool = None):
        """
        根据用途获取模板列表
        """
        query = select(Template).order_by(Template.updated_at.desc())
        query = query.where(Template.purpose == purpose)
        if is_system is not None:
            query = query.where(Template.is_system == is_system)
        if is_active is not None:
            query = query.where(Template.is_active == is_active)
        result = await db.execute(query)
        return result.scalars().all()