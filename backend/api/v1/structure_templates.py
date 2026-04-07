from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from core.auth import get_editor_user
from db.session import get_db
from services.structure_template_service import StructureTemplateService
from schemas.schemas import StructureTemplateCreate, StructureTemplateUpdate
from schemas.response_schemas import StructureTemplateResponse, StructureTemplateListResponse, StructureTemplateTreeResponse

router = APIRouter(prefix="/api/v1/structure-templates", tags=["文章结构模板管理"])


class StructureTemplateInsertAfter(BaseModel):
    after_id: UUID
    title: str
    level: int
    generation_mode: int = 0
    content_template: Optional[str] = None
    sources: Optional[list] = None
    default_prompt: Optional[str] = None
    custom_prompt: Optional[str] = None


class StructureTemplateReorder(BaseModel):
    parent_id: Optional[UUID] = None
    ordered_ids: List[UUID]


def _struct_response(t) -> StructureTemplateResponse:
    return StructureTemplateResponse(
        structure_template_id=t.structure_template_id,
        template_id=t.template_id,
        parent_id=t.parent_id,
        title=t.title,
        field_key=t.field_key,
        level=t.level,
        generation_mode=t.generation_mode,
        content_template=t.content_template,
        sources=t.sources,
        default_prompt=t.default_prompt,
        custom_prompt=t.custom_prompt,
        order_index=t.order_index,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.get("/template/{template_id}", summary="获取模板的结构模板列表", response_model=ResponseModel[StructureTemplateListResponse])
async def get_by_template_id(template_id: UUID, db: AsyncSession = Depends(get_db)):
    templates = await StructureTemplateService.get_by_template_id(db, template_id)
    return success_response(data=StructureTemplateListResponse(items=[_struct_response(t) for t in templates]))


@router.get("/template/{template_id}/tree", summary="获取模板的结构树", response_model=ResponseModel[StructureTemplateTreeResponse])
async def get_structure_tree(template_id: UUID, db: AsyncSession = Depends(get_db)):
    tree_data = await StructureTemplateService.get_structure_tree(db, template_id)

    def build_node(d) -> StructureTemplateResponse:
        return StructureTemplateResponse(
            structure_template_id=d["structure_template_id"],
            template_id=d.get("template_id", template_id),
            parent_id=d.get("parent_id"),
            title=d["title"],
            field_key=d["field_key"],
            level=d["level"],
            generation_mode=d["generation_mode"],
            content_template=d.get("content_template"),
            sources=d.get("sources"),
            default_prompt=d.get("default_prompt"),
            custom_prompt=d.get("custom_prompt"),
            order_index=d["order_index"],
            children=[build_node(c) for c in d.get("children", [])]
        )

    return success_response(data=StructureTemplateTreeResponse(tree=[build_node(n) for n in tree_data]))


@router.get("/{structure_template_id}", summary="获取结构模板详情", response_model=ResponseModel[StructureTemplateResponse])
async def get_by_id(structure_template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    return success_response(data=_struct_response(template))


@router.post("", summary="创建结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def create(data: StructureTemplateCreate, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    template = await StructureTemplateService.create(
        db,
        template_id=data.template_id,
        title=data.title,
        level=data.level,
        parent_id=data.parent_id,
        generation_mode=data.generation_mode,
        content_template=data.content_template,
        sources=[s.dict() for s in data.sources] if data.sources else None,
        default_prompt=data.default_prompt,
        custom_prompt=data.custom_prompt,
        order_index=data.order_index
    )
    return success_response(data=_struct_response(template))


@router.put("/{structure_template_id}", summary="更新结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def update(structure_template_id: UUID, data: StructureTemplateUpdate, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    update_data = {}
    for k, v in data.dict(exclude_unset=True).items():
        if k == "sources" and v is not None:
            update_data[k] = [s.dict() if hasattr(s, "dict") else s for s in v]
        elif v is not None:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    await StructureTemplateService.update(db, structure_template_id, **update_data)
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    return success_response(data=_struct_response(template))


@router.delete("/{structure_template_id}", summary="删除结构模板")
async def delete(structure_template_id: UUID, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    await StructureTemplateService.delete(db, structure_template_id)
    return success_response(message="删除成功")


@router.post("/template/{template_id}/insert-after", summary="在指定节点后插入结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def insert_after(template_id: UUID, data: StructureTemplateInsertAfter, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    try:
        template = await StructureTemplateService.insert_after(
            db, template_id, data.after_id, data.model_dump(exclude={"after_id"})
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(data=_struct_response(template))


@router.post("/template/{template_id}/reorder", summary="拖拽重排结构模板（支持跨父节点移动）")
async def reorder(template_id: UUID, data: StructureTemplateReorder, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    try:
        await StructureTemplateService.reorder(db, template_id, data.parent_id, data.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(message="排序更新成功")
