from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response, ResponseModel
from core.auth import get_editor_user
from db.session import get_db
from services.core_info_template_service import CoreInfoTemplateService
from schemas.schemas import CoreInfoTemplateCreate, CoreInfoTemplateUpdate, CoreInfoTemplateInsertAfter, CoreInfoTemplateReorder
from schemas.response_schemas import CoreInfoTemplateResponse, CoreInfoTemplateListResponse

router = APIRouter(prefix="/api/v1/core-info-templates", tags=["核心信息模板管理"])


def _ci_template_response(t) -> CoreInfoTemplateResponse:
    return CoreInfoTemplateResponse(
        core_template_id=t.core_template_id,
        template_id=t.template_id,
        parent_id=t.parent_id,
        field_name=t.field_name,
        field_key=t.field_key,
        field_type=t.field_type,
        default_value=t.default_value,
        options=t.options,
        is_required=t.is_required,
        order_index=t.order_index,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.get("/template/{template_id}", summary="获取模板的核心信息字段列表（树形结构）", response_model=ResponseModel[CoreInfoTemplateListResponse])
async def get_by_template_id(template_id: UUID, db: AsyncSession = Depends(get_db)):
    tree = await CoreInfoTemplateService.get_template_tree(db, template_id)

    def build_node(d) -> CoreInfoTemplateResponse:
        node = CoreInfoTemplateResponse(
            core_template_id=d["core_template_id"],
            template_id=d["template_id"],
            parent_id=d.get("parent_id"),
            field_name=d["field_name"],
            field_key=d["field_key"],
            field_type=d["field_type"],
            default_value=d.get("default_value"),
            options=d.get("options"),
            is_required=d["is_required"],
            order_index=d["order_index"],
            created_at=d.get("created_at"),
            updated_at=d.get("updated_at"),
            children=[build_node(c) for c in d.get("children", [])]
        )
        return node

    return success_response(data=CoreInfoTemplateListResponse(items=[build_node(n) for n in tree]))


@router.get("/{core_template_id}", summary="获取核心信息模板详情", response_model=ResponseModel[CoreInfoTemplateResponse])
async def get_by_id(core_template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await CoreInfoTemplateService.get_by_id(db, core_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="核心信息模板不存在")
    return success_response(data=_ci_template_response(template))


@router.post("", summary="创建核心信息模板（追加到同级末尾）", response_model=ResponseModel[CoreInfoTemplateResponse])
async def create(data: CoreInfoTemplateCreate, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    template = await CoreInfoTemplateService.create(
        db,
        template_id=data.template_id,
        parent_id=data.parent_id,
        field_name=data.field_name,
        field_type=data.field_type,
        default_value=data.default_value,
        options=data.options,
        is_required=data.is_required,
        order_index=data.order_index,
    )
    return success_response(data=_ci_template_response(template))


@router.post("/template/{template_id}/insert-after", summary="在指定节点之后插入新节点（同级）", response_model=ResponseModel[CoreInfoTemplateResponse])
async def insert_after(template_id: UUID, data: CoreInfoTemplateInsertAfter, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    try:
        template = await CoreInfoTemplateService.insert_after(
            db,
            template_id=template_id,
            after_id=data.after_id,
            field_name=data.field_name,
            field_type=data.field_type,
            default_value=data.default_value,
            options=data.options,
            is_required=data.is_required,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(data=_ci_template_response(template))


@router.post("/template/{template_id}/reorder", summary="拖拽重排（同级节点重新排序，支持跨父节点移动）")
async def reorder(template_id: UUID, data: CoreInfoTemplateReorder, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    try:
        await CoreInfoTemplateService.reorder(db, template_id=template_id, parent_id=data.parent_id, ordered_ids=data.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(message="排序更新成功")


@router.put("/{core_template_id}", summary="更新核心信息模板", response_model=ResponseModel[CoreInfoTemplateResponse])
async def update(core_template_id: UUID, data: CoreInfoTemplateUpdate, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    update_data = data.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    await CoreInfoTemplateService.update(db, core_template_id, **update_data)
    template = await CoreInfoTemplateService.get_by_id(db, core_template_id)
    if not template:
        raise HTTPException(status_code=404, detail="核心信息模板不存在")
    return success_response(data=_ci_template_response(template))


@router.delete("/{core_template_id}", summary="删除核心信息模板（同级后续节点自动补位）")
async def delete(core_template_id: UUID, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    await CoreInfoTemplateService.delete(db, core_template_id)
    return success_response(message="删除成功")
