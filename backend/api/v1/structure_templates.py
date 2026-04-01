from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.structure_template_service import StructureTemplateService
from schemas.schemas import StructureTemplateCreate, StructureTemplateUpdate

router = APIRouter(prefix="/api/v1/structure-templates", tags=["文章结构模板管理"])


@router.get("/template/{template_id}", summary="获取模板的结构模板列表")
async def get_by_template_id(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    templates = await StructureTemplateService.get_by_template_id(db, template_id)
    items = []
    for t in templates:
        items.append({
            "structure_template_id": str(t.structure_template_id),
            "template_id": str(t.template_id),
            "parent_id": str(t.parent_id) if t.parent_id else None,
            "title": t.title,
            "level": t.level,
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


@router.get("/template/{template_id}/tree", summary="获取模板的结构树")
async def get_structure_tree(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    tree = await StructureTemplateService.get_structure_tree(db, template_id)
    return success_response(data={"tree": tree})


@router.get("/{structure_template_id}", summary="获取结构模板详情")
async def get_by_id(
    structure_template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    return success_response(data={
        "structure_template_id": str(template.structure_template_id),
        "template_id": str(template.template_id),
        "parent_id": str(template.parent_id) if template.parent_id else None,
        "title": template.title,
        "level": template.level,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })


@router.post("", summary="创建结构模板")
async def create(
    data: StructureTemplateCreate,
    db: AsyncSession = Depends(get_db)
):
    template = await StructureTemplateService.create(
        db,
        template_id=data.template_id,
        title=data.title,
        field_key=data.field_key,
        level=data.level,
        parent_id=data.parent_id,
        generation_mode=data.generation_mode,
        content_template=data.content_template,
        sources=[s.dict() for s in data.sources] if data.sources else None,
        default_prompt=data.default_prompt,
        custom_prompt=data.custom_prompt,
        order_index=data.order_index
    )
    return success_response(data={
        "structure_template_id": str(template.structure_template_id),
        "template_id": str(template.template_id),
        "parent_id": str(template.parent_id) if template.parent_id else None,
        "title": template.title,
        "level": template.level,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index
    })


@router.put("/{structure_template_id}", summary="更新结构模板")
async def update(
    structure_template_id: UUID,
    data: StructureTemplateUpdate,
    db: AsyncSession = Depends(get_db)
):
    update_data = {}
    if data.parent_id is not None:
        update_data["parent_id"] = data.parent_id
    if data.title is not None:
        update_data["title"] = data.title
    if data.level is not None:
        update_data["level"] = data.level
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
    
    await StructureTemplateService.update(db, structure_template_id, **update_data)
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    
    return success_response(data={
        "structure_template_id": str(template.structure_template_id),
        "template_id": str(template.template_id),
        "parent_id": str(template.parent_id) if template.parent_id else None,
        "title": template.title,
        "level": template.level,
        "generation_mode": template.generation_mode,
        "content_template": template.content_template,
        "sources": template.sources,
        "default_prompt": template.default_prompt,
        "custom_prompt": template.custom_prompt,
        "order_index": template.order_index
    })


@router.delete("/{structure_template_id}", summary="删除结构模板")
async def delete(
    structure_template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    await StructureTemplateService.delete(db, structure_template_id)
    return success_response(message="删除成功")
