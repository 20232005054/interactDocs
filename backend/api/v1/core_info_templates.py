from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.core_info_template_service import CoreInfoTemplateService
from schemas.schemas import CoreInfoTemplateCreate, CoreInfoTemplateUpdate

router = APIRouter(prefix="/api/v1/core-info-templates", tags=["核心信息模板管理"])


@router.get("/template/{template_id}", summary="获取模板的核心信息字段列表")
async def get_by_template_id(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)):
    templates = await CoreInfoTemplateService.get_by_template_id(db, template_id)
    items = []
    for t in templates:
        items.append({
            "core_template_id": str(t.core_template_id),
            "template_id": str(t.template_id),
            "field_name": t.field_name,
            "field_key": t.field_key,
            "field_type": t.field_type,
            "default_value": t.default_value,
            "options": t.options,
            "is_required": t.is_required,
            "order_index": t.order_index,
            "created_at": t.created_at,
            "updated_at": t.updated_at
        })
    return success_response(data={"items": items})


@router.get("/{core_template_id}", summary="获取核心信息模板详情")
async def get_by_id(
    core_template_id: UUID,
    db: AsyncSession = Depends(get_db)):
    template = await CoreInfoTemplateService.get_by_id(db, core_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="核心信息模板不存在")
    return success_response(data={
        "core_template_id": str(template.core_template_id),
        "template_id": str(template.template_id),
        "field_name": template.field_name,
        "field_key": template.field_key,
        "field_type": template.field_type,
        "default_value": template.default_value,
        "options": template.options,
        "is_required": template.is_required,
        "order_index": template.order_index,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })


@router.post("", summary="创建核心信息模板")
async def create(
    data: CoreInfoTemplateCreate,
    db: AsyncSession = Depends(get_db)):
    template = await CoreInfoTemplateService.create(
        db,
        template_id=data.template_id,
        field_name=data.field_name,
        field_key=data.field_key,
        field_type=data.field_type,
        default_value=data.default_value,
        options=data.options,
        is_required=data.is_required,
        order_index=data.order_index
    )
    return success_response(data={
        "core_template_id": str(template.core_template_id),
        "template_id": str(template.template_id),
        "field_name": template.field_name,
        "field_key": template.field_key,
        "field_type": template.field_type,
        "default_value": template.default_value,
        "options": template.options,
        "is_required": template.is_required,
        "order_index": template.order_index
    })


@router.put("/{core_template_id}", summary="更新核心信息模板")
async def update(
    core_template_id: UUID,
    data: CoreInfoTemplateUpdate,
    db: AsyncSession = Depends(get_db)):
    update_data = data.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    
    await CoreInfoTemplateService.update(db, core_template_id, **update_data)
    template = await CoreInfoTemplateService.get_by_id(db, core_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="核心信息模板不存在")
    
    return success_response(data={
        "core_template_id": str(template.core_template_id),
        "template_id": str(template.template_id),
        "field_name": template.field_name,
        "field_key": template.field_key,
        "field_type": template.field_type,
        "default_value": template.default_value,
        "options": template.options,
        "is_required": template.is_required,
        "order_index": template.order_index
    })


@router.delete("/{core_template_id}", summary="删除核心信息模板")
async def delete(
    core_template_id: UUID,
    db: AsyncSession = Depends(get_db)):
    await CoreInfoTemplateService.delete(db, core_template_id)
    return success_response(message="删除成功")
