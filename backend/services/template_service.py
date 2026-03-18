from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID, uuid4
from db.models import Template
from db.mappers.template_mapper import TemplateMapper

class TemplateService:
    @staticmethod
    async def create_template(db: AsyncSession, purpose: str, display_name: str, content: dict, is_system: bool = False, user_id: UUID = None, group_id: UUID = None):
        """
        创建模板
        """
        # 如果没有指定group_id，则生成新的
        if not group_id:
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
        return await TemplateMapper.create_template(db, new_template)
    
    @staticmethod
    async def get_template(db: AsyncSession, template_id: UUID):
        """
        获取模板详情
        """
        return await TemplateMapper.get_template(db, template_id)
    
    @staticmethod
    async def list_templates(db: AsyncSession, purpose: str = None, is_system: bool = None, is_active: bool = None):
        """
        获取模板列表
        """
        return await TemplateMapper.list_templates(db, purpose, is_system, is_active)
    
    @staticmethod
    async def get_distinct_purposes(db: AsyncSession, is_system: bool = True):
        """
        获取所有不同的用途
        """
        return await TemplateMapper.get_distinct_purposes(db, is_system)
    
   
    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, **kwargs):
        """
        更新模板
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        # 检查是否需要更新版本（当content字段被修改时）
        if 'content' in kwargs:
            # 获取当前group_id下的最大版本号
            result = await db.execute(
                select(Template.version)
                .where(Template.group_id == template.group_id)
                .order_by(Template.version.desc())
                .limit(1)
            )
            max_version = result.scalar() or 0
            
            # 创建新版本，使用与当前版本相同的字段，除了content和version
            new_template = Template(
                group_id=template.group_id,
                purpose=kwargs.get('purpose', template.purpose),
                display_name=kwargs.get('display_name', template.display_name),
                content=kwargs['content'],
                version=max_version + 1,
                is_system=kwargs.get('is_system', template.is_system),
                user_id=template.user_id,
                is_active=kwargs.get('is_active', template.is_active)
            )
            
            # 将旧版本设为非活跃
            template.is_active = False
            
            db.add(new_template)
            await db.commit()
            await db.refresh(new_template)
            return new_template
        else:
            # 直接更新现有模板的其他字段
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
    async def update_template_content(db: AsyncSession, template_id: UUID, content: dict):
        """
        用户更新模板（仅修改content字段，不更新版本）
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        # 直接更新content字段
        template.content = content
        
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def get_templates_by_purpose(db: AsyncSession, purpose: str, is_system: bool = None, is_active: bool = None):
        """
        根据用途获取模板列表
        """
        return await TemplateMapper.get_templates_by_purpose(db, purpose, is_system, is_active)
    
    @staticmethod
    async def rollback_template(db: AsyncSession, template_id: UUID):
        """
        回退官方模板（根据模板id查找对应的官方模板并回退内容）
        """
        # 首先根据模板id获取模板信息
        source_template = await TemplateService.get_template(db, template_id)
        if not source_template:
            return None
        
        # 查找同group_id的官方模板
        result = await db.execute(
            select(Template)
            .where(Template.group_id == source_template.group_id)
            .where(Template.is_system == True)
        )
        official_template = result.scalar_one_or_none()
        
        if not official_template:
            return None
        
        # 直接修改原模板的内容
        source_template.purpose = official_template.purpose
        source_template.display_name = official_template.display_name
        source_template.content = official_template.content
        
        await db.commit()
        await db.refresh(source_template)
        return source_template

