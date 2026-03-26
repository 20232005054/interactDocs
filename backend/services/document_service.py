from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.models import Document,Chapter,Paragraph,DocumentVersion,Template,CoreInfoTemplate,SummaryTemplate,StructureTemplate,DocumentCoreInfo,DocumentSummary
from schemas.schemas import DocumentCreate, DocumentUpdate
from uuid import UUID, uuid4
from fastapi import HTTPException
from services.summary_template_service import SummaryTemplateService
from services.structure_template_service import StructureTemplateService

class DocumentService:
    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate):
        # 获取系统模板
        system_template = await TemplateMapper.get_template(db, doc_in.template_id)
        if not system_template:
            raise HTTPException(status_code=404, detail="模板不存在")
        
        # 创建新模板，使用系统模板的数据和group_id
        
        new_template_obj = Template(
            group_id=system_template.group_id,
            purpose=system_template.purpose,
            display_name=system_template.display_name,
            content=system_template.content,
            version=1,
            is_system=False,
            user_id=None,
            is_active=True
        )
        new_template = await TemplateMapper.create_template(db, new_template_obj)
        
        # 创建新文档，关联新创建的模板
        new_document = Document(
            title=doc_in.title,
            purpose=doc_in.purpose,
            template_id=new_template.template_id
        )
        
        return await DocumentMapper.create_document(db, new_document)

    @staticmethod
    async def list_documents(db: AsyncSession, page: int = 1, page_size: int = 9):
        # 查询文档总数
        count_result = await db.execute(select(func.count()).select_from(Document))
        total = count_result.scalar_one()
        
        # 分页查询文档，按更新时间倒序排列（最新的在前）
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document).order_by(Document.updated_at.desc()).offset(offset).limit(page_size)
        )
        documents = result.scalars().all()
        
        return total, documents

    @staticmethod
    async def get_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        return document

    @staticmethod
    async def update_document(db: AsyncSession, document_id: UUID, doc_in: DocumentUpdate):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 构建更新数据
        update_data = {}
        if doc_in.title is not None:
            update_data["title"] = doc_in.title
        if doc_in.purpose is not None:
            update_data["purpose"] = doc_in.purpose
        if doc_in.template_id is not None:
            update_data["template_id"] = doc_in.template_id
        
        await DocumentMapper.update_document(db, document_id, update_data)
        return await DocumentMapper.get_document_by_id(db, document_id)

    @staticmethod
    async def delete_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        await DocumentMapper.delete_document(db, document)
        return {"message": "删除成功"}
    
    @staticmethod
    async def get_global_variables(db: AsyncSession, document_id: UUID):
        """获取文档的全局变量"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        variables = document.content.get("global_variables", []) if document.content else []
        # 按 order_index 排序
        variables.sort(key=lambda x: x.get("order_index", 0))
        return variables
    
    @staticmethod
    async def update_global_variables(db: AsyncSession, document_id: UUID, global_variables):
        """更新文档的全局变量"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 将 Pydantic 模型转换为字典列表
        variables_dict = []
        for i, var in enumerate(global_variables):
            var_dict = var.dict() if hasattr(var, 'dict') else var
            # 确保每个变量都有 order_index
            if var_dict.get("order_index") is None:
                var_dict["order_index"] = i
            variables_dict.append(var_dict)
        
        # 更新 content 字段
        content = document.content or {}
        content["global_variables"] = variables_dict
        
        await DocumentMapper.update_document(db, document_id, {"content": content})
        updated_document = await DocumentMapper.get_document_by_id(db, document_id)
        variables = updated_document.content.get("global_variables", []) if updated_document.content else []
        # 按 order_index 排序
        variables.sort(key=lambda x: x.get("order_index", 0))
        return variables
    
    @staticmethod
    async def add_global_variable(db: AsyncSession, document_id: UUID, variable):
        """添加全局变量"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 将 Pydantic 模型转换为字典
        var_dict = variable.dict() if hasattr(variable, 'dict') else variable
        
        # 获取现有全局变量
        content = document.content or {}
        global_variables = content.get("global_variables", [])
        
        # 计算新变量的 order_index
        if global_variables:
            max_order = max(var.get("order_index", 0) for var in global_variables)
            var_dict["order_index"] = max_order + 1
        else:
            var_dict["order_index"] = 0
        
        # 添加新变量
        global_variables.append(var_dict)
        content["global_variables"] = global_variables
        
        # 更新文档
        await DocumentMapper.update_document(db, document_id, {"content": content})
        updated_document = await DocumentMapper.get_document_by_id(db, document_id)
        variables = updated_document.content.get("global_variables", []) if updated_document.content else []
        # 按 order_index 排序
        variables.sort(key=lambda x: x.get("order_index", 0))
        return variables
    
    @staticmethod
    async def update_global_variable(db: AsyncSession, document_id: UUID, order_index: int, variable_data):
        """更新单个全局变量"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取现有全局变量
        content = document.content or {}
        global_variables = content.get("global_variables", [])
        
        # 查找并更新变量
        updated = False
        for i, var in enumerate(global_variables):
            if var.get("order_index") == order_index:
                global_variables[i].update(variable_data)
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="全局变量不存在")
        
        # 更新文档
        content["global_variables"] = global_variables
        await DocumentMapper.update_document(db, document_id, {"content": content})
        updated_document = await DocumentMapper.get_document_by_id(db, document_id)
        variables = updated_document.content.get("global_variables", []) if updated_document.content else []
        # 按 order_index 排序
        variables.sort(key=lambda x: x.get("order_index", 0))
        return variables
    
    @staticmethod
    async def delete_global_variable(db: AsyncSession, document_id: UUID, order_index: int):
        """删除全局变量"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取现有全局变量
        content = document.content or {}
        global_variables = content.get("global_variables", [])
        
        # 查找并删除变量
        original_length = len(global_variables)
        global_variables = [var for var in global_variables if var.get("order_index") != order_index]
        
        if len(global_variables) == original_length:
            raise HTTPException(status_code=404, detail="全局变量不存在")
        
        # 重新计算 order_index
        for i, var in enumerate(global_variables):
            var["order_index"] = i
        
        # 更新文档
        content["global_variables"] = global_variables
        await DocumentMapper.update_document(db, document_id, {"content": content})
        return {"message": "删除成功"}
    
    @staticmethod
    async def get_document_snapshots(db: AsyncSession, document_id: UUID):
        """获取文档快照列表"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取快照列表
        snapshots = await DocumentMapper.get_snapshots_by_document_id(db, document_id)
        
        # 构建返回数据
        snapshot_list = []
        for snapshot in snapshots:
            snapshot_list.append({
                "version_id": snapshot.version_id,
                "document_id": snapshot.document_id,
                "description": snapshot.description,
                "snapshot_data": snapshot.snapshot_data,
                "created_at": snapshot.created_at,
                "created_by": snapshot.created_by
            })
        
        return snapshot_list
    
    @staticmethod
    async def get_snapshot_detail(db: AsyncSession, document_id: UUID, snapshot_id: UUID):
        """获取快照详情"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取快照详情
        snapshot = await DocumentMapper.get_snapshot_by_id(db, snapshot_id, document_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")
        
        # 确保章节的内容都是正确格式
        if "chapters" in snapshot.snapshot_data:
            for chapter in snapshot.snapshot_data["chapters"]:
                if "paragraphs" not in chapter:
                    chapter["paragraphs"] = []
        
        # 构建返回数据
        result_data = {
            "version_id": snapshot.version_id,
            "document_id": snapshot.document_id,
            "description": snapshot.description,
            "snapshot_data": snapshot.snapshot_data,
            "created_at": snapshot.created_at,
            "created_by": snapshot.created_by
        }
        
        return result_data

    @staticmethod
    async def apply_core_info_template(db: AsyncSession, document_id: UUID):
        """
        应用核心信息模板：根据模板创建文档的核心信息字段
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, document.template_id)
        
        created_items = []
        for idx, template in enumerate(core_info_templates):
            core_info = DocumentCoreInfo(
                document_id=document_id,
                title=template.field_name,
                content=template.default_value or "",
                order_index=idx,
                is_locked=False,
                is_change=0
            )
            db.add(core_info)
            created_items.append(core_info)
        
        await db.commit()
        return created_items

    @staticmethod
    async def apply_summary_template(db: AsyncSession, document_id: UUID):
        """
        应用摘要模板：根据模板创建文档的摘要
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
        
        core_info_map = await DocumentService._get_core_info_map(db, document_id)
        
        created_items = []
        for idx, template in enumerate(summary_templates):
            content = ""
            generation_mode = template.generation_mode
            
            if generation_mode == 0:
                content = SummaryTemplateService.generate_content_copy_mode(
                    template.content_template, template.sources, core_info_map
                )
            
            summary = DocumentSummary(
                document_id=document_id,
                title=template.title,
                content=content,
                version=1,
                is_change=0,
                order_index=idx
            )
            db.add(summary)
            created_items.append({
                "summary": summary,
                "template_id": str(template.summary_template_id),
                "generation_mode": generation_mode,
                "sources": template.sources
            })
        
        await db.commit()
        return created_items

    @staticmethod
    async def apply_structure_template(db: AsyncSession, document_id: UUID):
        """
        应用文章结构模板：根据模板创建文档的章节结构
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
        
        template_id_map = {}
        created_chapters = []
        
        sorted_templates = sorted(structure_templates, key=lambda x: (x.level, x.order_index))
        
        for template in sorted_templates:
            chapter = Chapter(
                document_id=document_id,
                parent_id=template_id_map.get(template.parent_id) if template.parent_id else None,
                title=template.title,
                status=0,
                order_index=template.order_index
            )
            db.add(chapter)
            await db.flush()
            
            template_id_map[template.structure_template_id] = chapter.chapter_id
            
            created_chapters.append({
                "chapter": chapter,
                "template_id": str(template.structure_template_id),
                "content_template": template.content_template,
                "sources": template.sources,
                "default_prompt": template.default_prompt,
                "custom_prompt": template.custom_prompt
            })
        
        await db.commit()
        return created_chapters

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        """
        获取文档核心信息的键值对映射
        key为field_key，value为content
        """
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()
        
        core_info_templates = await db.execute(
            select(CoreInfoTemplate).join(
                DocumentCoreInfo, 
                CoreInfoTemplate.field_name == DocumentCoreInfo.title
            ).where(DocumentCoreInfo.document_id == document_id)
        )
        templates = core_info_templates.scalars().all()
        
        template_map = {t.field_name: t.field_key for t in templates}
        
        core_info_map = {}
        for info in core_infos:
            field_key = template_map.get(info.title, info.title)
            core_info_map[field_key] = info.content
        
        return core_info_map

    @staticmethod
    async def get_template_info(db: AsyncSession, document_id: UUID):
        """
        获取文档关联的模板完整信息（包含核心信息模板、摘要模板、结构模板）
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, document.template_id)
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
        structure_tree = await StructureTemplateService.get_structure_tree(db, document.template_id)
        
        return {
            "template_id": str(document.template_id),
            "core_info_templates": [
                {
                    "core_template_id": str(t.core_template_id),
                    "field_name": t.field_name,
                    "field_key": t.field_key,
                    "field_type": t.field_type,
                    "default_value": t.default_value,
                    "options": t.options,
                    "is_required": t.is_required,
                    "order_index": t.order_index
                }
                for t in core_info_templates
            ],
            "summary_templates": [
                {
                    "summary_template_id": str(t.summary_template_id),
                    "title": t.title,
                    "generation_mode": t.generation_mode,
                    "content_template": t.content_template,
                    "sources": t.sources,
                    "default_prompt": t.default_prompt,
                    "custom_prompt": t.custom_prompt,
                    "order_index": t.order_index
                }
                for t in summary_templates
            ],
            "structure_templates": structure_tree
        }
    
    @staticmethod
    async def create_document_snapshot(db: AsyncSession, document_id: UUID):
        """创建文档快照"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 直接使用默认快照名格式
        document.snapshot_cursor += 1
        description = f"快照{document.snapshot_cursor}"
        
        # 获取文档的所有章节
        chapters_result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id)
        )
        chapters = chapters_result.scalars().all()
        
        # 获取每个章节的段落信息
        
        chapter_with_paragraphs = []
        for chapter in chapters:
            paragraphs_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = paragraphs_result.scalars().all()
            chapter_with_paragraphs.append((chapter, paragraphs))
        
        # 构建快照数据，只存储章节和段落信息
        snapshot_data = {
            "chapters": [
                {
                    "chapter_id": str(chapter.chapter_id),
                    "title": chapter.title,
                    "status": chapter.status,
                    "order_index": chapter.order_index,
                    "paragraphs": [
                        {
                            "paragraph_id": str(para.paragraph_id),
                            "content": para.content,
                            "para_type": para.para_type,
                            "order_index": para.order_index,
                            "ai_eval": para.ai_eval,
                            "ai_suggestion": para.ai_suggestion,
                            "ai_generate": para.ai_generate,
                            "ischange": para.ischange
                        }
                        for para in paragraphs
                    ]
                }
                for chapter, paragraphs in chapter_with_paragraphs
            ]
        }
        
        # 创建快照
       
        new_snapshot = DocumentVersion(
            document_id=document_id,
            description=description,
            snapshot_data=snapshot_data,
            created_by=None  # 临时设置为None，实际项目中应该从JWT中获取用户ID
        )
        
        # 保存快照
        new_snapshot = await DocumentMapper.create_snapshot(db, new_snapshot)
        
        # 构建返回数据
        result_data = {
            "version_id": new_snapshot.version_id,
            "document_id": new_snapshot.document_id,
            "description": new_snapshot.description,
            "snapshot_data": new_snapshot.snapshot_data,
            "created_at": new_snapshot.created_at,
            "created_by": new_snapshot.created_by
        }
        
        return result_data
    
    @staticmethod
    async def update_snapshot(db: AsyncSession, snapshot_id: UUID, description: str):
        """更新快照信息"""
        # 检查快照是否存在
        
        result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")
        
        # 更新快照描述
        await DocumentMapper.update_snapshot(db, snapshot_id, {"description": description})
        
        # 获取更新后的快照
        updated_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        updated_snapshot = updated_result.scalar_one_or_none()
        
        # 构建返回数据
        result_data = {
            "version_id": updated_snapshot.version_id,
            "document_id": updated_snapshot.document_id,
            "description": updated_snapshot.description,
            "snapshot_data": updated_snapshot.snapshot_data,
            "created_at": updated_snapshot.created_at,
            "created_by": updated_snapshot.created_by
        }
        
        return result_data
