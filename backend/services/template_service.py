from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from db.models import Template

class TemplateService:
    @staticmethod
    async def create_template(db: AsyncSession, purpose: str, display_name: str, content: dict, is_system: bool = False, user_id: UUID = None):
        """
        创建模板
        """
        group_id = uuid4()
        new_template = Template(
            group_id=group_id,
            purpose=purpose,
            display_name=display_name,
            content=content,
            version=1,
            is_system=is_system,
            user_id=user_id,
            is_active=True
        )
        db.add(new_template)
        await db.commit()
        await db.refresh(new_template)
        return new_template
    
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
    async def list_templates(db: AsyncSession, purpose: str = None, is_system: bool = None, is_active: bool = None):
        """
        获取模板列表
        """
        query = select(Template)
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
    async def clone_template(db: AsyncSession, template_id: UUID, user_id: UUID):
        """
        克隆模板（从系统模板创建私有副本）
        """
        original_template = await TemplateService.get_template(db, template_id)
        if not original_template:
            return None
        
        # 生成新的group_id用于私有模板
        new_group_id = uuid4()
        
        # 创建私有副本
        cloned_template = Template(
            group_id=new_group_id,
            template_type=original_template.template_type,
            purpose=original_template.purpose,
            display_name=original_template.display_name,
            content=original_template.content,
            version=1,
            is_system=False,
            user_id=user_id,
            is_active=True
        )
        db.add(cloned_template)
        await db.commit()
        await db.refresh(cloned_template)
        return cloned_template
    
    @staticmethod
    async def create_version(db: AsyncSession, template_id: UUID, content: dict):
        """
        创建模板新版本
        """
        current_template = await TemplateService.get_template(db, template_id)
        if not current_template:
            return None
        
        # 获取当前group_id下的最大版本号
        result = await db.execute(
            select(Template.version)
            .where(Template.group_id == current_template.group_id)
            .order_by(Template.version.desc())
            .limit(1)
        )
        max_version = result.scalar() or 0
        
        # 创建新版本
        new_template = Template(
            group_id=current_template.group_id,
            template_type=current_template.template_type,
            purpose=current_template.purpose,
            display_name=current_template.display_name,
            content=content,
            version=max_version + 1,
            is_system=current_template.is_system,
            user_id=current_template.user_id,
            is_active=True
        )
        
        # 将旧版本设为非活跃
        current_template.is_active = False
        
        db.add(new_template)
        await db.commit()
        await db.refresh(new_template)
        return new_template
    
    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, **kwargs):
        """
        更新模板
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        # 如果更新内容，创建新版本
        if 'content' in kwargs:
            return await TemplateService.create_version(db, template_id, kwargs['content'])
        
        # 更新其他字段
        for key, value in kwargs.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def delete_template(db: AsyncSession, template_id: UUID):
        """
        删除模板
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return False
        
        await db.delete(template)
        await db.commit()
        return True
    
    @staticmethod
    async def get_templates_by_purpose(db: AsyncSession, purpose: str, is_system: bool = True, is_active: bool = True):
        """
        根据用途获取模板列表
        """
        query = select(Template)
        query = query.where(Template.purpose == purpose)
        if is_system is not None:
            query = query.where(Template.is_system == is_system)
        if is_active is not None:
            query = query.where(Template.is_active == is_active)
        result = await db.execute(query)
        return result.scalars().all()

