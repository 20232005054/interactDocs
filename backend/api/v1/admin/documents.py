from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from core.auth import get_admin_user
from core.response import success_response, ResponseModel
from db.session import get_db
from schemas.schemas import PaginationParams
from schemas.response_schemas import DocumentListResponse
from services.document_service import DocumentService

router = APIRouter(prefix="/api/v1/admin/documents", tags=["管理员-文档管理"])


@router.get("", summary="查询所有文档", response_model=ResponseModel[DocumentListResponse])
async def list_all_documents(
    pagination: PaginationParams = Depends(),
    keyword: Optional[str] = None,
    user_id: Optional[UUID] = None,
    purpose: Optional[str] = None,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """查询所有用户的文档，支持标题关键词、归属用户、用途过滤"""
    from schemas.response_schemas import DocumentListItem
    total, documents = await DocumentService.list_documents(
        db, pagination, keyword=keyword, filter_user_id=user_id, purpose=purpose
    )
    items = [
        DocumentListItem(
            document_id=item["doc"].document_id,
            title=item["doc"].title,
            purpose=item["doc"].purpose,
            template_purpose=item["purpose"],
            template_name=item["display_name"],
            user_id=item["doc"].user_id,
            created_at=item["doc"].created_at,
            updated_at=item["doc"].updated_at,
        )
        for item in documents
    ]
    return success_response(data=DocumentListResponse(
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        items=items,
    ))


@router.delete("/{document_id}", summary="强制删除任意文档", response_model=ResponseModel[None])
async def force_delete_document(
    document_id: UUID,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """管理员强制删除任意用户的文档"""
    result = await DocumentService.delete_document(db, document_id)
    return success_response(message=result["message"])
