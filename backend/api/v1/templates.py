from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response, ResponseModel
from db.session import get_db
from services.template_service import TemplateService
from schemas.response_schemas import TemplateResponse, TemplateDetailResponse, TemplateListResponse, PurposeListResponse
from core.auth import get_editor_user, get_admin_user

router = APIRouter(prefix="/api/v1/templates", tags=["模板管理"])


def _template_response(t) -> TemplateResponse:
    return TemplateResponse(
        template_id=t.template_id,
        group_id=t.group_id,
        purpose=t.purpose,
        display_name=t.display_name,
        content=t.content,
        version=t.version,
        is_system=t.is_system,
        user_id=t.user_id,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.post("", summary="创建模板", response_model=ResponseModel[TemplateDetailResponse])
async def create_template(
    purpose: str, display_name: str, content: dict,
    is_system: bool = False, user_id: Optional[UUID] = None,
    editor=Depends(get_editor_user),
    db: AsyncSession = Depends(get_db)
):
    t = await TemplateService.create_template(db, purpose, display_name, content, is_system, user_id)
    return success_response(data=TemplateDetailResponse(
        template_id=t.template_id, group_id=t.group_id, document_id=t.document_id,
        purpose=t.purpose, display_name=t.display_name, content=t.content,
        version=t.version, is_system=t.is_system, user_id=t.user_id,
        is_active=t.is_active, created_at=t.created_at, updated_at=t.updated_at
    ))


@router.get("/{template_id}", summary="获取模板详情", response_model=ResponseModel[TemplateDetailResponse])
async def get_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    t = await TemplateService.get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=TemplateDetailResponse(
        template_id=t.template_id, group_id=t.group_id, document_id=t.document_id,
        purpose=t.purpose, display_name=t.display_name, content=t.content,
        version=t.version, is_system=t.is_system, user_id=t.user_id,
        is_active=t.is_active, created_at=t.created_at, updated_at=t.updated_at
    ))


@router.get("", summary="获取模板列表", response_model=ResponseModel[TemplateListResponse])
async def list_templates(
    purpose: Optional[str] = None,
    is_system: Optional[bool] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    items, total = await TemplateService.list_templates(db, purpose, is_system, is_active, keyword, page, page_size)
    return success_response(data=TemplateListResponse(
        page=page, page_size=page_size, total=total,
        items=[_template_response(t) for t in items]
    ))


@router.put("/{template_id}", summary="管理员更新模板", response_model=ResponseModel[TemplateResponse])
async def update_template(
    template_id: UUID,
    purpose: Optional[str] = None, display_name: Optional[str] = None,
    content: Optional[dict] = None, is_system: Optional[bool] = None,
    is_active: Optional[bool] = None, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)
):
    update_data = {k: v for k, v in {
        "purpose": purpose, "display_name": display_name, "content": content,
        "is_system": is_system, "is_active": is_active
    }.items() if v is not None}
    t = await TemplateService.update_template(db, template_id, **update_data)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=_template_response(t))


@router.delete("/{template_id}", summary="删除模板")
async def delete_template(template_id: UUID, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    success = await TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(message="删除成功")


@router.put("/{template_id}/content", summary="用户更新模板", response_model=ResponseModel[TemplateResponse])
async def update_template_content(template_id: UUID, content: dict, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    t = await TemplateService.get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    if t.is_system:
        raise HTTPException(status_code=403, detail="不能更新官方模板")
    t = await TemplateService.update_template_content(db, template_id, content)
    return success_response(data=_template_response(t))


@router.get("/purposes/list", summary="获取所有用途", response_model=ResponseModel[PurposeListResponse])
async def list_purposes(is_system: bool = True, db: AsyncSession = Depends(get_db)):
    purposes = await TemplateService.get_distinct_purposes(db, is_system)
    return success_response(data=PurposeListResponse(purposes=purposes))


@router.get("/by-purpose/{purpose}", summary="根据用途获取模板", response_model=ResponseModel[TemplateListResponse])
async def get_templates_by_purpose(
    purpose: str, is_system: Optional[bool] = None,
    is_active: Optional[bool] = None, db: AsyncSession = Depends(get_db)
):
    templates = await TemplateService.get_templates_by_purpose(db, purpose, is_system, is_active)
    return success_response(data=TemplateListResponse(items=[_template_response(t) for t in templates]))


@router.post("/rollback/{template_id}", summary="回退官方模板", response_model=ResponseModel[TemplateResponse])
async def rollback_template(template_id: UUID, admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    t = await TemplateService.rollback_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=_template_response(t))
