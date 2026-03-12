from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.document_mapper import DocumentMapper
from db.models import Document, Template
from schemas.schemas import DocumentCreate, DocumentUpdate
from uuid import UUID
from fastapi import HTTPException
from services.template_service import TemplateService

class DocumentService:
    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate):
        # 处理模板克隆逻辑
        template_id = doc_in.template_id
        if template_id:
            # 检查模板是否存在
            template = await TemplateService.get_template(db, template_id)
            if template and template.is_system:
                # 如果是系统模板，为用户克隆一个私有副本
                # 这里假设用户ID会从JWT中获取，暂时使用None
                # 实际项目中应该从请求上下文获取用户ID
                user_id = None  # 临时值，实际项目中需要修改
                cloned_template = await TemplateService.clone_template(db, template_id, user_id)
                if cloned_template:
                    template_id = cloned_template.template_id
        
        # 创建新文档
        new_document = Document(
            title=doc_in.title,
            abstract=doc_in.abstract,
            content=doc_in.content if doc_in.content else [],
            purpose=doc_in.purpose,
            template_id=template_id,
            status="draft"
        )
        
        return await DocumentMapper.create_document(db, new_document)

    @staticmethod
    async def list_documents(db: AsyncSession, page: int = 1, page_size: int = 10):
        from sqlalchemy.future import select
        
        # 查询文档总数
        count_result = await db.execute(select(Document))
        total = len(count_result.scalars().all())
        
        # 分页查询文档
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document).offset(offset).limit(page_size)
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
        if doc_in.abstract is not None:
            update_data["abstract"] = doc_in.abstract
        if doc_in.content is not None:
            update_data["content"] = doc_in.content
        if doc_in.purpose is not None:
            update_data["purpose"] = doc_in.purpose
        if doc_in.template_id is not None:
            update_data["template_id"] = doc_in.template_id
        if doc_in.status is not None:
            update_data["status"] = doc_in.status
        
        await DocumentMapper.update_document(db, document_id, update_data)
        return await DocumentMapper.get_document_by_id(db, document_id)

    @staticmethod
    async def delete_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        await DocumentMapper.delete_document(db, document)
        return {"message": "删除成功"}
