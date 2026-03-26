from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from schemas.schemas import CoreInfo, CoreInfoCreate, CoreInfoUpdate, CoreInfoOrderUpdate
from services.core_info_service import CoreInfoService
import uuid
from core.response import success_response

router = APIRouter()

@router.post("/", response_model=CoreInfo, summary="创建核心信息")
async def create_core_info(core_info: CoreInfoCreate, db: AsyncSession = Depends(get_db)):
    """
    创建核心信息
    
    - **document_id**: 文档ID
    - **title**: 核心信息标题
    - **content**: 核心信息内容
    - **order_index**: 排序索引（可选）
    - **is_locked**: 是否锁定（默认False）
    """
    result = await CoreInfoService.create_core_info(db, core_info)
    return success_response(result)

@router.get("/{core_info_id}", response_model=CoreInfo, summary="获取核心信息详情")
async def get_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    根据ID获取核心信息详情
    """
    result = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not result:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    return success_response(result)

@router.get("/document/{document_id}", response_model=list[CoreInfo], summary="获取文档的核心信息列表")
async def get_core_info_by_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    获取指定文档的所有核心信息，按order_index排序
    """
    result = await CoreInfoService.get_core_info_by_document_id(db, document_id)
    return success_response(result)

@router.put("/{core_info_id}", response_model=CoreInfo, summary="更新核心信息")
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
    return success_response(result)

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

@router.post("/{core_info_id}/lock", response_model=CoreInfo, summary="锁定核心信息")
async def lock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    锁定核心信息，锁定后无法修改内容
    """
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    
    result = await CoreInfoService.lock_core_info(db, core_info_id)
    return success_response(result, "锁定成功")

@router.post("/{core_info_id}/unlock", response_model=CoreInfo, summary="解锁核心信息")
async def unlock_core_info(core_info_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    解锁核心信息，解锁后可以修改内容
    """
    existing = await CoreInfoService.get_core_info_by_id(db, core_info_id)
    if not existing:
        raise HTTPException(status_code=404, detail="核心信息不存在")
    
    result = await CoreInfoService.unlock_core_info(db, core_info_id)
    return success_response(result, "解锁成功")
