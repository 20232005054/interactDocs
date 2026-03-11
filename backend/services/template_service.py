from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.models import PromptTemplate, DocumentSchemaTemplate

class TemplateService:
    @staticmethod
    async def create_prompt_template(db: AsyncSession, task_type: str, purpose: str, system_prompt: str, user_prompt_template: str):
        """
        创建提示词模板
        """
        new_template = PromptTemplate(
            task_type=task_type,
            purpose=purpose,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template
        )
        db.add(new_template)
        await db.commit()
        await db.refresh(new_template)
        return new_template
    
    @staticmethod
    async def get_prompt_template(db: AsyncSession, template_id: UUID):
        """
        获取提示词模板详情
        """
        result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.template_id == template_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def list_prompt_templates(db: AsyncSession, task_type: str = None, purpose: str = None):
        """
        获取提示词模板列表
        """
        query = select(PromptTemplate)
        if task_type:
            query = query.where(PromptTemplate.task_type == task_type)
        if purpose:
            query = query.where(PromptTemplate.purpose == purpose)
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def update_prompt_template(db: AsyncSession, template_id: UUID, **kwargs):
        """
        更新提示词模板
        """
        template = await TemplateService.get_prompt_template(db, template_id)
        if not template:
            return None
        for key, value in kwargs.items():
            if hasattr(template, key):
                setattr(template, key, value)
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def delete_prompt_template(db: AsyncSession, template_id: UUID):
        """
        删除提示词模板
        """
        template = await TemplateService.get_prompt_template(db, template_id)
        if not template:
            return False
        await db.delete(template)
        await db.commit()
        return True
    
    @staticmethod
    async def create_schema_template(db: AsyncSession, purpose: str, schema_json: dict, description: str = None):
        """
        创建文档结构模板
        """
        new_template = DocumentSchemaTemplate(
            purpose=purpose,
            schema_json=schema_json,
            description=description
        )
        db.add(new_template)
        await db.commit()
        await db.refresh(new_template)
        return new_template
    
    @staticmethod
    async def get_schema_template(db: AsyncSession, template_id: UUID):
        """
        获取文档结构模板详情
        """
        result = await db.execute(
            select(DocumentSchemaTemplate).where(DocumentSchemaTemplate.template_id == template_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def list_schema_templates(db: AsyncSession, purpose: str = None):
        """
        获取文档结构模板列表
        """
        query = select(DocumentSchemaTemplate)
        if purpose:
            query = query.where(DocumentSchemaTemplate.purpose == purpose)
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def update_schema_template(db: AsyncSession, template_id: UUID, **kwargs):
        """
        更新文档结构模板
        """
        template = await TemplateService.get_schema_template(db, template_id)
        if not template:
            return None
        for key, value in kwargs.items():
            if hasattr(template, key):
                setattr(template, key, value)
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def delete_schema_template(db: AsyncSession, template_id: UUID):
        """
        删除文档结构模板
        """
        template = await TemplateService.get_schema_template(db, template_id)
        if not template:
            return False
        await db.delete(template)
        await db.commit()
        return True
