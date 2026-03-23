from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.models import Document,Chapter,Paragraph,DocumentVersion,Template
from schemas.schemas import DocumentCreate, DocumentUpdate
from uuid import UUID
from fastapi import HTTPException

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
