from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from schemas.schemas import CoreInfo, CoreInfoCreate, CoreInfoUpdate, CoreInfoOrderUpdate
from services.core_info_service import CoreInfoService
import uuid
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from core.response import success_response

router = APIRouter(prefix="/api/v1", tags=["核心信息管理"])


class CoreInfoReorder(BaseModel):
    parent_id: Optional[UUID] = None
    ordered_ids: List[UUID]

@router.post("/documents/{document_id}/core-info", summary="创建核心信息")
async def create_core_info(document_id: uuid.UUID, core_info: CoreInfoCreate, db: AsyncSession = Depends(get_db)):
    """
    创建核心信息
    
    - **document_id**: 文档ID (URL路径参数)
    - **title**: 核心信息标题
    - **content**: 核心信息内容
    - **order_index**: 排序索引（可选）
    - **is_locked**: 是否锁定（默认False）
    """
    result = await CoreInfoService.create_core_info(db, document_id, core_info)
    # 将 SQLAlchemy 模型转换为 Pydantic Schema 后再返回给 success_response
    return success_response(CoreInfo.model_validate(result))

@router.get("/{core_info_id}", summary="获取核心信息详情")
async def get_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    根据ID获取核心信息详情
    """
    result = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not result:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    return success_response(CoreInfo.model_validate(result))

@router.get("/document/{document_id}", summary="获取文档的核心信息列表（树形结构）")
async def get_core_info_by_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    获取指定文档的所有核心信息，按order_index排序并组装为树形结构
    """
    tree = await CoreInfoService.get_core_info_tree(db, document_id)
    return success_response(tree)

@router.put("/{core_info_id}", summary="更新核心信息")
async def update_core_info(core_info_id: uuid.UUID, core_info: CoreInfoUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新核心信息
    
    - **title**: 核心信息标题（可选）
    - **content**: 核心信息内容（可选）
    - **is_locked**: 是否锁定（可选）
    - **is_change**: 变更标记（可选）
    """
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    
    # 检查锁定状态
    if existing.is_locked and (core_info.title is not None or core_info.content is not None):
        raise HTTPException(status_code=400, detail="核心信息已锁定，无法修改")
    
    result = await CoreInfoService.update_core_info(db, core_info_id, core_info)
    return success_response(CoreInfo.model_validate(result))

@router.delete("/{core_info_id}", summary="删除核心信息")
async def delete_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    删除核心信息
    """
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    
    # 检查锁定状态
    if existing.is_locked:
        raise HTTPException(status_code=400, detail="核心信息已锁定，无法删除")
    
    success = await CoreInfoService.delete_core_info(db, core_info_id)
    return success_response(None, "删除成功" if success else "删除失败")

@router.put("/{core_info_id}/order", summary="更新核心信息排序")
async def update_core_info_order(core_info_id: uuid.UUID, order_update: CoreInfoOrderUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新核心信息的排序索引
    
    - **new_order**: 新的排序索引
    """
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    
    success = await CoreInfoService.update_order(db, existing.document_id, core_info_id, order_update.new_order)
    return success_response(None, "排序更新成功" if success else "排序更新失败")

@router.post("/{core_info_id}/lock", summary="锁定核心信息")
async def lock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    result = await CoreInfoService.lock_core_info(db, core_info_id)
    return success_response(CoreInfo.model_validate(result), "锁定成功")

@router.post("/{core_info_id}/unlock", summary="解锁核心信息")
async def unlock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    result = await CoreInfoService.unlock_core_info(db, core_info_id)
    return success_response(CoreInfo.model_validate(result), "解锁成功")


@router.post("/documents/{document_id}/core-info/reorder", summary="批量重排核心信息（拖拽排序）")
async def reorder_core_info(document_id: uuid.UUID, data: CoreInfoReorder, db: AsyncSession = Depends(get_db)):
    """
    传入同级节点的新顺序 ID 列表，按下标重写 order_index。
    支持跨父节点移动：若节点原 parent_id 与传入 parent_id 不同，同时更新 parent_id。
    """
    try:
        await CoreInfoService.reorder(db, document_id, data.parent_id, data.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success_response(None, "排序更新成功")
