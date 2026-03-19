from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.response import success_response
from services.endpoint_service import EndpointService
from services.dependency_service import DependencyService
from uuid import UUID

router = APIRouter(prefix="/api/v1")

# --- 辅助功能模块 ---
@router.get("/history", summary="获取操作历史记录")
async def get_operation_history(page: int = 1, page_size: int = 10, db: AsyncSession = Depends(get_db)):
    """
    获取操作历史记录
    """
    total, items = await EndpointService.get_operation_history(db, page, page_size)
    return success_response(data={"total": total, "items": items})

@router.get("/dependencies/{entity_type}/{entity_id}", summary="获取实体的上下游依赖")
async def get_entity_dependencies(
    entity_type: str,
    entity_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定实体的上下游依赖关系
    
    Args:
        entity_type: 实体类型 (paragraph/summary/keyword)
        entity_id: 实体ID
        
    Returns:
        包含上游和下游依赖的信息
    """
    # 验证实体类型
    valid_types = ["paragraph", "summary", "keyword"]
    if entity_type not in valid_types:
        return success_response(data={"error": "无效的实体类型"}, code=400)
    
    # 获取上下游依赖
    dependencies = await DependencyService.get_dependencies(db, entity_type, entity_id)
    
    return success_response(data=dependencies)


