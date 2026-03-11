from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.document_mapper import DocumentMapper
from db.models import Document
from schemas.schemas import DocumentCreate, DocumentUpdate
from uuid import UUID
from fastapi import HTTPException

class DocumentService:
    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate):
        # 创建新文档
        new_document = Document(
            title=doc_in.title,
            abstract=doc_in.abstract,
            content=doc_in.content if doc_in.content else [],
            purpose=doc_in.purpose,
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
