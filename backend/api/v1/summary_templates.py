from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from core.auth import get_editor_user, get_current_user
from core.constants import UserRole, TemplateType
from db.session import get_db
from services.summary_template_service import SummaryTemplateService
from services.template_service import TemplateService
from schemas.template_schemas import SummaryTemplateCreate, SummaryTemplateUpdate, SummaryTemplateInsertAfter, SummaryTemplateReorder
from schemas.response_schemas import SummaryTemplateResponse, SummaryTemplateListResponse

router = APIRouter(prefix="/api/v1/summary-templates", tags=["摘要模板管理"])


async def _check_template_permission(db, template_id: UUID, current_user):
    """系统模板只有 editor/admin 可写，私有模板所有登录用户可写"""
    tpl = await TemplateService.get_template(db, template_id)
    if tpl and tpl.template_type == TemplateType.SYSTEM and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="系统模板需要编辑权限")


def _st_response(t) -> SummaryTemplateResponse:
    return SummaryTemplateResponse(
        summary_template_id=t.summary_template_id,
        template_id=t.template_id,
        title=t.title,
        field_key=t.field_key,
        generation_mode=t.generation_mode,
        content_template=t.content_template,
        sources=t.sources,
        default_prompt=t.default_prompt,
        custom_prompt=t.custom_prompt,
        order_index=t.order_index,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.get("/template/{template_id}", summary="获取模板的摘要模板列表", response_model=ResponseModel[SummaryTemplateListResponse])
async def get_by_template_id(template_id: UUID, db: AsyncSession = Depends(get_db)):
    templates = await SummaryTemplateService.get_by_template_id(db, template_id)
    return success_response(data=SummaryTemplateListResponse(items=[_st_response(t) for t in templates]))


@router.get("/{summary_template_id}", summary="获取摘要模板详情", response_model=ResponseModel[SummaryTemplateResponse])
async def get_by_id(summary_template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="摘要模板不存在")
    return success_response(data=_st_response(template))


@router.post("", summary="创建摘要模板", response_model=ResponseModel[SummaryTemplateResponse])
async def create(data: SummaryTemplateCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, data.template_id, current_user)
    template = await SummaryTemplateService.create(
        db,
        template_id=data.template_id,
        title=data.title,
        generation_mode=data.generation_mode,
        content_template=data.content_template,
        sources=[s.dict() for s in data.sources] if data.sources else None,
        default_prompt=data.default_prompt,
        custom_prompt=data.custom_prompt,
        order_index=data.order_index
    )
    return success_response(data=_st_response(template))


@router.put("/{summary_template_id}", summary="更新摘要模板", response_model=ResponseModel[SummaryTemplateResponse])
async def update(summary_template_id: UUID, data: SummaryTemplateUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template_rec = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if template_rec:
        await _check_template_permission(db, template_rec.template_id, current_user)
    update_data = data.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    await SummaryTemplateService.update(db, summary_template_id, **update_data)
    template = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="摘要模板不存在")
    return success_response(data=_st_response(template))


@router.delete("/{summary_template_id}", summary="删除摘要模板")
async def delete(summary_template_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template_rec = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if template_rec:
        await _check_template_permission(db, template_rec.template_id, current_user)
    await SummaryTemplateService.delete(db, summary_template_id)
    return success_response(message="删除成功")


@router.post("/template/{template_id}/insert-after", summary="在指定节点后插入摘要模板", response_model=ResponseModel[SummaryTemplateResponse])
async def insert_after(template_id: UUID, data: SummaryTemplateInsertAfter, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, template_id, current_user)
    try:
        template = await SummaryTemplateService.insert_after(
            db, template_id, data.after_id, data.model_dump(exclude={"after_id"})
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(data=_st_response(template))


@router.post("/template/{template_id}/reorder", summary="拖拽重排摘要模板")
async def reorder(template_id: UUID, data: SummaryTemplateReorder, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, template_id, current_user)
    await SummaryTemplateService.reorder(db, template_id, data.ordered_ids)
    return success_response(message="排序更新成功")
