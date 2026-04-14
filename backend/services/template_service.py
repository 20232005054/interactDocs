from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID, uuid4
from db.models import Template
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.models import Template, CoreInfoTemplate, SummaryTemplate, StructureTemplate

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
    async def list_templates(
        db: AsyncSession,
        purpose: str = None,
        is_system: bool = None,
        is_active: bool = None,
        keyword: str = None,
        page: int = 1,
        page_size: int = 20,
    ):
        """
        获取模板列表（支持分页和关键词搜索）
        """
        return await TemplateMapper.list_templates(db, purpose, is_system, is_active, keyword, page, page_size)
    
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
    async def list_templates_for_user(
        db: AsyncSession,
        user_id: UUID,
        purpose: str = None,
        is_active: bool = None,
        keyword: str = None,
        page: int = 1,
        page_size: int = 20,
    ):
        """
        返回系统模板 + 当前用户个人模板库（document_id IS NULL）的合并列表
        """
        from sqlalchemy import func, or_, and_

        base_filter = or_(
            and_(Template.is_system == True, Template.is_active == True),
            and_(Template.is_system == False, Template.user_id == user_id, Template.document_id == None, Template.is_active == True),
        )

        query = select(Template).where(base_filter).order_by(Template.is_system.desc(), Template.updated_at.desc())

        if purpose:
            query = query.where(Template.purpose == purpose)
        if is_active is not None:
            # 已在 base_filter 里限定了 is_active=True，此处可额外过滤
            query = query.where(Template.is_active == is_active)
        if keyword:
            query = query.where(Template.display_name.ilike(f"%{keyword}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        return result.scalars().all(), total

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
        
        # 1. 清空当前用户模板的旧子表数据
        await CoreInfoTemplateMapper.delete_by_template_id(db, source_template.template_id)
        await SummaryTemplateMapper.delete_by_template_id(db, source_template.template_id)
        await StructureTemplateMapper.delete_by_template_id(db, source_template.template_id)

        # 2. 深拷贝官方模板的 CoreInfoTemplate
        old_core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, official_template.template_id)
        if old_core_infos:
            new_core_infos = []
            for old_ci in old_core_infos:
                new_ci = CoreInfoTemplate(
                    template_id=source_template.template_id,
                    field_name=old_ci.field_name,
                    field_key=old_ci.field_key,
                    field_type=old_ci.field_type,
                    default_value=old_ci.default_value,
                    options=old_ci.options,
                    is_required=old_ci.is_required,
                    order_index=old_ci.order_index
                )
                new_core_infos.append(new_ci)
            await CoreInfoTemplateMapper.batch_create(db, new_core_infos)

        # 3. 深拷贝官方模板的 SummaryTemplate
        old_summaries = await SummaryTemplateMapper.get_by_template_id(db, official_template.template_id)
        if old_summaries:
            new_summaries = []
            for old_sum in old_summaries:
                new_sum = SummaryTemplate(
                    template_id=source_template.template_id,
                    title=old_sum.title,
                    generation_mode=old_sum.generation_mode,
                    content_template=old_sum.content_template,
                    sources=old_sum.sources,
                    default_prompt=old_sum.default_prompt,
                    custom_prompt=old_sum.custom_prompt,
                    order_index=old_sum.order_index
                )
                new_summaries.append(new_sum)
            await SummaryTemplateMapper.batch_create(db, new_summaries)

        # 4. 深拷贝官方模板的 StructureTemplate (处理树形结构)
        old_structures = await StructureTemplateMapper.get_by_template_id(db, official_template.template_id)
        if old_structures:
            # 按层级排序，确保父节点先于子节点处理
            sorted_old_structures = sorted(old_structures, key=lambda x: x.level)
            
            id_mapping = {}
            new_structures = []
            
            for old_struct in sorted_old_structures:
                new_struct_id = uuid4()
                id_mapping[old_struct.structure_template_id] = new_struct_id
                
                new_parent_id = None
                if old_struct.parent_id:
                    new_parent_id = id_mapping.get(old_struct.parent_id)
                
                new_struct = StructureTemplate(
                    structure_template_id=new_struct_id,
                    template_id=source_template.template_id,
                    parent_id=new_parent_id,
                    title=old_struct.title,
                    level=old_struct.level,
                    generation_mode=old_struct.generation_mode,
                    content_template=old_struct.content_template,
                    sources=old_struct.sources,
                    default_prompt=old_struct.default_prompt,
                    custom_prompt=old_struct.custom_prompt,
                    order_index=old_struct.order_index
                )
                new_structures.append(new_struct)
            
            await StructureTemplateMapper.batch_create(db, new_structures)

        # 5. 直接修改原模板的主表内容 (兜底字段覆盖)
        source_template.purpose = official_template.purpose
        source_template.display_name = official_template.display_name
        source_template.content = official_template.content
        
        await db.commit()
        await db.refresh(source_template)
        return source_template

