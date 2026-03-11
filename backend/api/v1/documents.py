from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import uuid
import re

from schemas.schemas import DocumentCreate, DocumentUpdate, DocumentVersionCreate
from core.response import success_response
from db.session import get_db
from db.models import Chapter, DocumentVersion, Document
from services.ai_service import generate_chapter_titles
from services.document_service import DocumentService

router = APIRouter(prefix="/api/v1/documents", tags=["文档管理"])

@router.post("", summary="创建新文档")
async def create_document(doc_in: DocumentCreate, db: AsyncSession = Depends(get_db)):
    new_document = await DocumentService.create_document(db, doc_in)
    
    # 构建返回数据
    result = {
        "document_id": new_document.document_id,
        "title": new_document.title,
        "abstract": new_document.abstract,
        "content": new_document.content,
        "purpose": new_document.purpose,
        "status": new_document.status,
        "created_at": new_document.created_at,
        "updated_at": new_document.updated_at
    }
    return success_response(data=result)

@router.get("", summary="获取文档列表")
async def list_documents(page: int = 1, page_size: int = 10, db: AsyncSession = Depends(get_db)):
    total, documents = await DocumentService.list_documents(db, page, page_size)
    
    # 构建返回数据
    items = []
    for doc in documents:
        items.append({
            "document_id": doc.document_id,
            "title": doc.title,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at
        })
    
    return success_response(data={"total": total, "items": items})

@router.get("/{document_id}", summary="获取文档详情")
async def get_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    document = await DocumentService.get_document(db, document_id)
    
    # 构建返回数据
    result = {
        "document_id": document.document_id,
        "title": document.title,
        "abstract": document.abstract,
        "content": document.content,
        "purpose": document.purpose,
        "status": document.status,
        "created_at": document.created_at,
        "updated_at": document.updated_at
    }
    return success_response(data=result)

@router.post("/{document_id}/generate", summary="生成方案结构")
async def generate_scheme_schema(document_id: UUID, db: AsyncSession = Depends(get_db)):
    # 检查文档是否存在
    result = await db.execute(
        select(Document).where(Document.document_id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 调用 AI 生成章节标题
    chapter_titles = await generate_chapter_titles(
        title=document.title,
        keywords=[],
        abstract=document.abstract,
        content=document.content,
        purpose=document.purpose
    )
    
    chapters = []
    
    for i, title in enumerate(chapter_titles, 1):
        # 创建包含标题的Block Schema
        content = [{
            "id": str(uuid.uuid4()),
            "type": "heading-1",
            "content": title,
            "order_index": 1,
            "metadata": {
                "status": "draft",
                "ai_evaluation": "",
                "ai_fill_suggestion": "",
                "ai_revision_suggestion": ""
            }
        }]
        new_chapter = Chapter(
            document_id=document_id,
            title=title,
            content=content,
            status="editing",
            order_index=i
        )
        db.add(new_chapter)
        chapters.append(new_chapter)
    
    await db.commit()
    
    # 构建返回数据
    result_chapters = []
    for chapter in chapters:
        # 从章节内容中提取标题（如果有）
        chapter_title = ""
        if chapter.content:
            for block in chapter.content:
                if block.get('type') in ['heading-1', 'heading-2', 'heading-3']:
                    chapter_title = block.get('content', '')
                    break
        result_chapters.append({
            "chapter_id": chapter.chapter_id,
            "title": chapter_title,
            "status": chapter.status,
            "order_index": chapter.order_index
        })
    
    return success_response(data={"message": "生成成功", "chapters": result_chapters})


@router.put("/{document_id}", summary="更新文档信息")
async def update_document(document_id: UUID, doc_in: DocumentUpdate, db: AsyncSession = Depends(get_db)):
    document = await DocumentService.update_document(db, document_id, doc_in)
    
    # 构建返回数据
    result = {
        "document_id": document.document_id,
        "title": document.title,
        "abstract": document.abstract,
        "content": document.content,
        "purpose": document.purpose,
        "status": document.status,
        "created_at": document.created_at,
        "updated_at": document.updated_at
    }
    return success_response(data=result)


@router.delete("/{document_id}", summary="删除文档")
async def delete_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await DocumentService.delete_document(db, document_id)
    return success_response(message=result["message"])


@router.get("/{document_id}/snapshots", summary="获取文档快照列表")
async def get_document_snapshots(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档快照列表
    """
    # 检查文档是否存在
    doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 查询文档的快照
    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    snapshots = result.scalars().all()
    
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
    
    return success_response(data={"snapshots": snapshot_list})


@router.get("/{document_id}/snapshots/detail/{snapshot_id}", summary="获取快照详情")
async def get_snapshot_detail(document_id: UUID, snapshot_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取快照详情
    """
    # 检查文档是否存在
    doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 查询快照详情
    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.version_id == snapshot_id)
        .where(DocumentVersion.document_id == document_id)
    )
    snapshot = result.scalar_one_or_none()
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    # 构建返回数据
    # 确保文档和章节的内容都是 Block Schema 格式
    if "document" in snapshot.snapshot_data:
        if "content" in snapshot.snapshot_data["document"] and snapshot.snapshot_data["document"]["content"] is None:
            snapshot.snapshot_data["document"]["content"] = []
    if "chapters" in snapshot.snapshot_data:
        for chapter in snapshot.snapshot_data["chapters"]:
            if "content" in chapter and chapter["content"] is None:
                chapter["content"] = []
    
    result_data = {
        "version_id": snapshot.version_id,
        "document_id": snapshot.document_id,
        "description": snapshot.description,
        "snapshot_data": snapshot.snapshot_data,
        "created_at": snapshot.created_at,
        "created_by": snapshot.created_by
    }
    
    return success_response(data=result_data)


@router.get("/{document_id}/snapshots-meta/default-description", summary="获取默认快照描述")
async def get_default_snapshot_description(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取默认快照描述
    """
    # 检查文档是否存在
    doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
    document = doc_result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 生成默认描述
    default_description = f"快照{document.snapshot_cursor + 1}"
    
    return success_response(data={"default_description": default_description})


@router.post("/{document_id}/snapshots", summary="创建文档快照")
async def create_document_snapshot(document_id: UUID, snapshot_in: DocumentVersionCreate, db: AsyncSession = Depends(get_db)):
    """
    创建文档快照
    """
    # 检查文档是否存在
    doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
    document = doc_result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 处理描述
    description = snapshot_in.description
    
    # 检查是否是默认格式
    snapshot_pattern = r'^快照(\d+)$'
    match = re.match(snapshot_pattern, description)
    
    if match:
        # 用户输入了默认格式，提取数字
        snapshot_number = int(match.group(1))
        # 如果输入的数字大于当前计数器，更新计数器
        if snapshot_number > document.snapshot_cursor:
            document.snapshot_cursor = snapshot_number
    else:
        # 不是默认格式，使用默认描述
        document.snapshot_cursor += 1
        description = f"快照{document.snapshot_cursor}"
    
    # 获取文档的所有章节
    chapters_result = await db.execute(
        select(Chapter).where(Chapter.document_id == document_id)
    )
    chapters = chapters_result.scalars().all()
    
    # 构建快照数据
    snapshot_data = {
        "document": {
            "document_id": str(document.document_id),
            "title": document.title,
            "abstract": document.abstract,
            "content": document.content if document.content else [],
            "purpose": document.purpose,
            "status": document.status
        },
        "chapters": [
            {
                "chapter_id": str(chapter.chapter_id),
                "title": chapter.title,
                "content": chapter.content if chapter.content else [],
                "status": chapter.status,
                "order_index": chapter.order_index
            }
            for chapter in chapters
        ]
    }
    
    # 创建快照
    new_snapshot = DocumentVersion(
        document_id=document_id,
        description=description,
        snapshot_data=snapshot_data,
        created_by=None  # 临时设置为None，实际项目中应该从JWT中获取用户ID
    )
    
    db.add(new_snapshot)
    await db.commit()
    await db.refresh(new_snapshot)
    
    # 构建返回数据
    result_data = {
        "version_id": new_snapshot.version_id,
        "document_id": new_snapshot.document_id,
        "description": new_snapshot.description,
        "snapshot_data": new_snapshot.snapshot_data,
        "created_at": new_snapshot.created_at,
        "created_by": new_snapshot.created_by
    }
    
    return success_response(data=result_data)