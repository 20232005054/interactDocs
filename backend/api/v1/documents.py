from services.chapter_service import ChapterService
from services.document_service import DocumentService
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from schemas.schemas import DocumentCreate, DocumentUpdate, SnapshotUpdate, GlobalVariablesUpdate, GlobalVariable
from core.response import success_response
from db.session import get_db


router = APIRouter(prefix="/api/v1/documents", tags=["文档管理"])

@router.post("", summary="创建新文档")
async def create_document(doc_in: DocumentCreate, db: AsyncSession = Depends(get_db)):
    new_document = await DocumentService.create_document(db, doc_in)
    
    # 构建返回数据
    result = {
        "document_id": new_document.document_id,
        "title": new_document.title,
        "purpose": new_document.purpose,
        "template_id": new_document.template_id,
        "created_at": new_document.created_at,
        "updated_at": new_document.updated_at
    }
    return success_response(data=result)

@router.get("", summary="获取文档列表")
async def list_documents(
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db)
):
    total, documents = await DocumentService.list_documents(db, page, page_size)
    
    # 构建返回数据
    items = []
    for doc in documents:
        items.append({
            "document_id": doc.document_id,
            "title": doc.title,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at
        })
    
    return success_response(data={
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": items
    })

@router.get("/{document_id}", summary="获取文档详情")
async def get_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    document = await DocumentService.get_document(db, document_id)
    
    # 构建返回数据
    result = {
        "document_id": document.document_id,
        "title": document.title,
        "content": document.content,
        "purpose": document.purpose,
        "template_id": document.template_id,
        "created_at": document.created_at,
        "updated_at": document.updated_at
    }
    return success_response(data=result)

@router.put("/{document_id}", summary="更新文档信息")
async def update_document(document_id: UUID, doc_in: DocumentUpdate, db: AsyncSession = Depends(get_db)):
    document = await DocumentService.update_document(db, document_id, doc_in)
    
    # 构建返回数据
    result = {
        "document_id": document.document_id,
        "title": document.title,
        "purpose": document.purpose,
        "template_id": document.template_id,
        "created_at": document.created_at,
        "updated_at": document.updated_at
    }
    return success_response(data=result)


@router.delete("/{document_id}", summary="删除文档")
async def delete_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await DocumentService.delete_document(db, document_id)
    return success_response(message=result["message"])

@router.get("/documents/{document_id}/chapters", summary="获取文档章节列表")
async def get_chapters(document_id: UUID, db: AsyncSession = Depends(get_db)):
    chapters = await ChapterService.get_chapters_by_document_id(db, document_id)
    return success_response(data={"chapters": chapters})

@router.get("/{document_id}/snapshots", summary="获取文档快照列表")
async def get_document_snapshots(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档快照列表
    """
    snapshots = await DocumentService.get_document_snapshots(db, document_id)
    return success_response(data={"snapshots": snapshots})


@router.get("/{document_id}/snapshots/detail/{snapshot_id}", summary="获取快照详情")
async def get_snapshot_detail(document_id: UUID, snapshot_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取快照详情
    """
    snapshot = await DocumentService.get_snapshot_detail(db, document_id, snapshot_id)
    return success_response(data=snapshot)

@router.post("/{document_id}/snapshots", summary="创建文档快照")
async def create_document_snapshot(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    创建文档快照
    """
    snapshot = await DocumentService.create_document_snapshot(db, document_id)
    return success_response(data=snapshot)

@router.put("/snapshots/{snapshot_id}", summary="更新快照信息")
async def update_snapshot(snapshot_id: UUID, snapshot_in: SnapshotUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新快照信息
    """
    snapshot = await DocumentService.update_snapshot(db, snapshot_id, snapshot_in.description)
    return success_response(data=snapshot)


@router.get("/{document_id}/global-variables", summary="获取文档全局变量")
async def get_global_variables(document_id: UUID, db: AsyncSession = Depends(get_db)):
    variables = await DocumentService.get_global_variables(db, document_id)
    return success_response(data=variables)

@router.put("/{document_id}/global-variables", summary="更新文档全局变量")
async def update_global_variables(document_id: UUID, update_data: GlobalVariablesUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新文档全局变量
    
    请求体示例：
    {
        "variables": [
            {
                "key": "研究名称",
                "value": "临床试验A",
                "type": "string",
                "description": "研究项目名称",
                "is_locked": false,
                "order_index": 0
            }
        ]
    }
    """
    updated_variables = await DocumentService.update_global_variables(db, document_id, update_data.variables)
    return success_response(data=updated_variables)

@router.post("/{document_id}/global-variables", summary="添加全局变量")
async def add_global_variable(document_id: UUID, variable: GlobalVariable, db: AsyncSession = Depends(get_db)):
    """
    添加全局变量
    
    请求体示例：
    {
        "key": "研究名称",
        "value": "临床试验A",
        "type": "string",
        "description": "研究项目名称",
        "is_locked": false
    }
    """
    updated_variables = await DocumentService.add_global_variable(db, document_id, variable)
    return success_response(data=updated_variables)

@router.put("/{document_id}/global-variables/{order_index}", summary="更新单个全局变量")
async def update_global_variable(document_id: UUID, order_index: int, variable_data: dict, db: AsyncSession = Depends(get_db)):
    """
    更新单个全局变量
    """
    updated_variables = await DocumentService.update_global_variable(db, document_id, order_index, variable_data)
    return success_response(data=updated_variables)

@router.delete("/{document_id}/global-variables/{order_index}", summary="删除全局变量")
async def delete_global_variable(document_id: UUID, order_index: int, db: AsyncSession = Depends(get_db)):
    result = await DocumentService.delete_global_variable(db, document_id, order_index)
    return success_response(message=result["message"])
