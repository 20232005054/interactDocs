
from services.document_service import DocumentService
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from schemas.schemas import DocumentCreate, DocumentUpdate, SnapshotUpdate, PaginationParams
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
async def list_documents(pagination: PaginationParams = Depends(),db: AsyncSession = Depends(get_db)):
    page = pagination.page
    page_size = pagination.page_size
    
    total, documents = await DocumentService.list_documents(db, pagination)
    
    # 构建返回数据
    items = []
    for item in documents:
        doc = item["doc"]
        items.append({
            "document_id": doc.document_id,
            "title": doc.title,
            "template_purpose": item["purpose"],
            "template_name": item["display_name"],
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
    document, template_name = await DocumentService.get_document(db, document_id)
    
    result = {
        "document_id": document.document_id,
        "title": document.title,
        "purpose": document.purpose,
        "template_id": document.template_id,
        "template_name": template_name,
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


@router.get("/{document_id}/template-info", summary="获取文档关联的模板完整信息")
async def get_template_info(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档关联的模板完整信息，包含核心信息模板、摘要模板、结构模板
    """
    template_info = await DocumentService.get_template_info(db, document_id)
    return success_response(data=template_info)


@router.post("/{document_id}/apply-core-info-template", summary="应用核心信息模板")
async def apply_core_info_template(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    应用核心信息模板：根据模板创建文档的核心信息字段
    """
    created_items = await DocumentService.apply_core_info_template(db, document_id)
    
    # 组装树形结构
    info_dict_map = {}
    for item in created_items:
        info_dict_map[item.core_info_id] = {
            "core_info_id": str(item.core_info_id),
            "parent_id": str(item.parent_id) if item.parent_id else None,
            "title": item.title,
            "content": item.content,
            "order_index": item.order_index,
            "children": []
        }
        
    tree = []
    for item in created_items:
        node = info_dict_map[item.core_info_id]
        if item.parent_id and item.parent_id in info_dict_map:
            info_dict_map[item.parent_id]["children"].append(node)
        else:
            tree.append(node)
            
    def sort_tree(nodes):
        nodes.sort(key=lambda x: x["order_index"])
        for n in nodes:
            if n["children"]:
                sort_tree(n["children"])
                
    sort_tree(tree)

    return success_response(data={
        "message": f"成功创建 {len(created_items)} 个核心信息字段",
        "items": tree
    })


@router.post("/{document_id}/apply-summary-template", summary="应用摘要模板")
async def apply_summary_template(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    应用摘要模板：根据模板创建文档的摘要
    """
    created_items = await DocumentService.apply_summary_template(db, document_id)
    return success_response(data={
        "message": f"成功创建 {len(created_items)} 个摘要",
        "items": [
            {
                "summary_id": str(item["summary"].summary_id),
                "title": item["summary"].title,
                "field_key": item["summary"].field_key,
                "content": item["summary"].content,
                "order_index": item["summary"].order_index,
                "generation_mode": item["generation_mode"],
                "sources": item["sources"],
                "degraded": item.get("degraded", False),
                "generation_error": item.get("generation_error"),
            }
            for item in created_items
        ]
    })


@router.post("/{document_id}/apply-structure-template", summary="应用文章结构模板")
async def apply_structure_template(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    应用文章结构模板：根据模板创建文档的章节结构
    """
    created_items = await DocumentService.apply_structure_template(db, document_id)
    return success_response(data={
        "message": f"成功创建 {len(created_items)} 个章节",
        "items": [
            {
                "chapter_id": str(item["chapter"].chapter_id),
                "title": item["chapter"].title,
                "level": item["chapter"].order_index,
                "order_index": item["chapter"].order_index,
                "generation_mode": item["generation_mode"],
                "content_template": item["content_template"],
                "sources": item["sources"],
                "default_prompt": item["default_prompt"],
                "custom_prompt": item["custom_prompt"],
                "degraded": item.get("degraded", False),
                "generation_error": item.get("generation_error"),
                "paragraph_id": str(item["paragraph"].paragraph_id) if item.get("paragraph") else None,
                "paragraph_content": item.get("paragraph_content"),
            }
            for item in created_items
        ]
    })
