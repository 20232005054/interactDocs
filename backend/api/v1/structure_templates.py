from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from core.auth import get_current_user
from core.constants import UserRole, TemplateType
from db.session import get_db
from services.structure_template_service import StructureTemplateService
from services.template_service import TemplateService
from schemas.schemas import StructureTemplateCreate, StructureTemplateUpdate, StructureTemplateParagraphDef
from schemas.response_schemas import StructureTemplateResponse, StructureTemplateListResponse, StructureTemplateTreeResponse

router = APIRouter(prefix="/api/v1/structure-templates", tags=["文章结构模板管理"])


async def _check_template_permission(db, template_id: UUID, current_user):
    tpl = await TemplateService.get_template(db, template_id)
    if tpl and tpl.template_type == TemplateType.SYSTEM and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="系统模板需要编辑权限")


class StructureTemplateInsertAfter(BaseModel):
    after_id: UUID
    title: str
    level: int
    paragraphs: Optional[List[StructureTemplateParagraphDef]] = None


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
        order_index=t.order_index,
        paragraphs=t.paragraphs,
        created_at=t.created_at,
        updated_at=t.updated_at,
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
            order_index=d["order_index"],
            paragraphs=d.get("paragraphs"),
            children=[build_node(c) for c in d.get("children", [])],
        )

    return success_response(data=StructureTemplateTreeResponse(tree=[build_node(n) for n in tree_data]))


@router.get("/{structure_template_id}", summary="获取结构模板详情", response_model=ResponseModel[StructureTemplateResponse])
async def get_by_id(structure_template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    return success_response(data=_struct_response(template))


@router.post("", summary="创建结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def create(data: StructureTemplateCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, data.template_id, current_user)
    paragraphs = [p.model_dump() for p in data.paragraphs] if data.paragraphs else None
    template = await StructureTemplateService.create(
        db,
        template_id=data.template_id,
        title=data.title,
        level=data.level,
        parent_id=data.parent_id,
        order_index=data.order_index,
        paragraphs=paragraphs,
    )
    return success_response(data=_struct_response(template))


@router.put("/{structure_template_id}", summary="更新结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def update(structure_template_id: UUID, data: StructureTemplateUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tpl_rec = await StructureTemplateService.get_by_id(db, structure_template_id)
    if tpl_rec:
        await _check_template_permission(db, tpl_rec.template_id, current_user)
    update_data = data.model_dump(exclude_unset=True)
    if "paragraphs" in update_data and update_data["paragraphs"] is not None:
        update_data["paragraphs"] = [
            p.model_dump() if hasattr(p, "model_dump") else p
            for p in data.paragraphs
        ]
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    await StructureTemplateService.update(db, structure_template_id, **update_data)
    template = await StructureTemplateService.get_by_id(db, structure_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="结构模板不存在")
    return success_response(data=_struct_response(template))


@router.delete("/{structure_template_id}", summary="删除结构模板")
async def delete(structure_template_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tpl_rec = await StructureTemplateService.get_by_id(db, structure_template_id)
    if tpl_rec:
        await _check_template_permission(db, tpl_rec.template_id, current_user)
    await StructureTemplateService.delete(db, structure_template_id)
    return success_response(message="删除成功")


@router.post("/template/{template_id}/insert-after", summary="在指定节点后插入结构模板", response_model=ResponseModel[StructureTemplateResponse])
async def insert_after(template_id: UUID, data: StructureTemplateInsertAfter, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, template_id, current_user)
    try:
        paragraphs = [p.model_dump() for p in data.paragraphs] if data.paragraphs else None
        template = await StructureTemplateService.insert_after(
            db, template_id, data.after_id,
            {"title": data.title, "level": data.level, "paragraphs": paragraphs},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(data=_struct_response(template))


@router.post("/template/{template_id}/reorder", summary="拖拽重排结构模板（支持跨父节点移动）")
async def reorder(template_id: UUID, data: StructureTemplateReorder, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_template_permission(db, template_id, current_user)
    try:
        await StructureTemplateService.reorder(db, template_id, data.parent_id, data.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(message="排序更新成功")
