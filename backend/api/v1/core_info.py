from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from schemas.schemas import CoreInfoCreate, CoreInfoUpdate, CoreInfoOrderUpdate
from schemas.response_schemas import CoreInfoResponse
from services.core_info_service import CoreInfoService
import uuid
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from core.response import success_response, ResponseModel

router = APIRouter(prefix="/api/v1/core-info", tags=["核心信息管理"])


class CoreInfoReorder(BaseModel):
    parent_id: Optional[UUID] = None
    ordered_ids: List[UUID]


def _build_core_info_response(info) -> CoreInfoResponse:
    return CoreInfoResponse(
        core_info_id=info.core_info_id,
        document_id=info.document_id,
        parent_id=info.parent_id,
        title=info.title,
        field_key=getattr(info, "field_key", None),
        content=info.content,
        field_type=info.field_type,
        options=info.options,
        is_required=info.is_required,
        order_index=info.order_index,
        is_locked=info.is_locked,
        is_change=info.is_change,
        created_at=info.created_at,
        updated_at=info.updated_at,
    )


class CoreInfoTreeResponse(BaseModel):
    items: List[CoreInfoResponse]


@router.post("/documents/{document_id}", summary="创建核心信息", response_model=ResponseModel[CoreInfoResponse])
async def create_core_info(document_id: uuid.UUID, core_info: CoreInfoCreate, db: AsyncSession = Depends(get_db)):
    result = await CoreInfoService.create_core_info(db, document_id, core_info)
    return success_response(data=_build_core_info_response(result))


@router.get("/{core_info_id}", summary="获取核心信息详情", response_model=ResponseModel[CoreInfoResponse])
async def get_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not result:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    return success_response(data=_build_core_info_response(result))


@router.get("/document/{document_id}", summary="获取文档的核心信息列表（树形结构）", response_model=ResponseModel[CoreInfoTreeResponse])
async def get_core_info_by_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tree = await CoreInfoService.get_core_info_tree(db, document_id)
    return success_response(data=CoreInfoTreeResponse(items=tree))


@router.put("/{core_info_id}", summary="更新核心信息", response_model=ResponseModel[CoreInfoResponse])
async def update_core_info(core_info_id: uuid.UUID, core_info: CoreInfoUpdate, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    if existing.is_locked and (core_info.title is not None or core_info.content is not None):
        raise HTTPException(status_code=400, detail="核心信息已锁定，无法修改")
    result = await CoreInfoService.update_core_info(db, core_info_id, core_info)
    return success_response(data=_build_core_info_response(result))


@router.delete("/{core_info_id}", summary="删除核心信息", response_model=ResponseModel[None])
async def delete_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    if existing.is_locked:
        raise HTTPException(status_code=400, detail="核心信息已锁定，无法删除")
    success = await CoreInfoService.delete_core_info(db, core_info_id)
    return success_response(message="删除成功" if success else "删除失败")


@router.put("/{core_info_id}/order", summary="更新核心信息排序", response_model=ResponseModel[None])
async def update_core_info_order(core_info_id: uuid.UUID, order_update: CoreInfoOrderUpdate, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    success = await CoreInfoService.update_order(db, existing.document_id, core_info_id, order_update.new_order)
    return success_response(None, "排序更新成功" if success else "排序更新失败")


@router.post("/{core_info_id}/lock", summary="锁定核心信息", response_model=ResponseModel[CoreInfoResponse])
async def lock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    result = await CoreInfoService.lock_core_info(db, core_info_id)
    return success_response(data=_build_core_info_response(result), message="锁定成功")


@router.post("/{core_info_id}/unlock", summary="解锁核心信息", response_model=ResponseModel[CoreInfoResponse])
async def unlock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    result = await CoreInfoService.unlock_core_info(db, core_info_id)
    return success_response(data=_build_core_info_response(result), message="解锁成功")


@router.post("/documents/{document_id}/reorder", summary="批量重排核心信息（拖拽排序）", response_model=ResponseModel[None])
async def reorder_core_info(document_id: uuid.UUID, data: CoreInfoReorder, db: AsyncSession = Depends(get_db)):
    try:
        await CoreInfoService.reorder(db, document_id, data.parent_id, data.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(None, "排序更新成功")
