"""
管理员 - 模板管理接口

所有接口需要 admin 角色。

- GET    /templates              分页查询所有模板（含私有副本）
- DELETE /templates/{id}         强制删除任意模板
- PUT    /templates/{id}/active  批量启用/禁用模板
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from pydantic import BaseModel

from core.auth import get_admin_user
from core.response import success_response, ResponseModel
from db.session import get_db
from schemas.document_schemas import PaginationParams
from schemas.response_schemas import TemplateListResponse, TemplateResponse
from services.template_service import TemplateService

router = APIRouter(prefix="/api/v1/admin/templates", tags=["管理员-模板管理"])


def _template_response(t) -> TemplateResponse:
    return TemplateResponse(
        template_id=t.template_id,
        group_id=t.group_id,
        purpose=t.purpose,
        display_name=t.display_name,
        content=t.content,
        version=t.version,
        template_type=t.template_type,
        user_id=t.user_id,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


class TemplateActiveUpdate(BaseModel):
    is_active: bool


@router.get("", summary="查询所有模板（含私有副本）", response_model=ResponseModel[TemplateListResponse])
async def list_all_templates(
    pagination: PaginationParams = Depends(),
    purpose: Optional[str] = None,
    template_type: Optional[int] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = None,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """管理员可查询所有类型的模板，包括文档私有副本（type=0）"""
    items, total = await TemplateService.list_templates(
        db, purpose, template_type, is_active, keyword,
        pagination.page, pagination.page_size,
    )
    return success_response(data=TemplateListResponse(
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        items=[_template_response(t) for t in items],
    ))


@router.delete("/{template_id}", summary="强制删除任意模板", response_model=ResponseModel[None])
async def force_delete_template(
    template_id: UUID,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """管理员强制删除任意模板（包括系统模板和用户私有模板）"""
    success = await TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(message="删除成功")


@router.put("/{template_id}/active", summary="启用或禁用模板", response_model=ResponseModel[TemplateResponse])
async def set_template_active(
    template_id: UUID,
    payload: TemplateActiveUpdate,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """管理员启用或禁用任意模板"""
    t = await TemplateService.update_template(db, template_id, is_active=payload.is_active)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=_template_response(t))
