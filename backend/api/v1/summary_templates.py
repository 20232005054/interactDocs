from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.summary_template_service import SummaryTemplateService
from schemas.schemas import SummaryTemplateCreate, SummaryTemplateUpdate

router = APIRouter(prefix="/api/v1/summary-templates", tags=["摘要模板管理"])


@router.get("/template/{template_id}", summary="获取模板的摘要模板列表")
async def get_by_template_id(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    templates = await SummaryTemplateService.get_by_template_id(db, template_id)
    items = []
    for t in templates:
        items.append({
            "summary_template_id": str(t.summary_template_id),
            "template_id": str(t.template_id),
            "title": t.title,
            "generation_mode": t.generation_mode,
            "content_template": t.content_template,
            "sources": t.sources,
            "default_prompt": t.default_prompt,
            "custom_prompt": t.custom_prompt,
            "order_index": t.order_index,
            "created_at": t.created_at,
            "updated_at": t.updated_at
        })
    return success_response(data={"items": items})


@router.get("/{summary_template_id}", summary="获取摘要模板详情")
async def get_by_id(
    summary_template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    template = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="摘要模板不存在")
    return success_response(data={
        "summary_template_id": str(template.summary_template_id),
        "template_id": str(template.template_id),
        "title": template.title,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })


@router.post("", summary="创建摘要模板")
async def create(
    data: SummaryTemplateCreate,
    db: AsyncSession = Depends(get_db)
):
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
    return success_response(data={
        "summary_template_id": str(template.summary_template_id),
        "template_id": str(template.template_id),
        "title": template.title,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index
    })


@router.put("/{summary_template_id}", summary="更新摘要模板")
async def update(
    summary_template_id: UUID,
    data: SummaryTemplateUpdate,
    db: AsyncSession = Depends(get_db)
):
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title
    if data.generation_mode is not None:
        update_data["generation_mode"] = data.generation_mode
    if data.content_template is not None:
        update_data["content_template"] = data.content_template
    if data.sources is not None:
        update_data["sources"] = [s.dict() for s in data.sources]
    if data.default_prompt is not None:
        update_data["default_prompt"] = data.default_prompt
    if data.custom_prompt is not None:
        update_data["custom_prompt"] = data.custom_prompt
    if data.order_index is not None:
        update_data["order_index"] = data.order_index
    
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    
    await SummaryTemplateService.update(db, summary_template_id, **update_data)
    template = await SummaryTemplateService.get_by_id(db, summary_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="摘要模板不存在")
    
    return success_response(data={
        "summary_template_id": str(template.summary_template_id),
        "template_id": str(template.template_id),
        "title": template.title,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index
    })


@router.delete("/{summary_template_id}", summary="删除摘要模板")
async def delete(
    summary_template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    await SummaryTemplateService.delete(db, summary_template_id)
    return success_response(message="删除成功")
