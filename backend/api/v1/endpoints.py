from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.response import success_response, ResponseModel
from services.endpoint_service import EndpointService
from services.dependency_service import DependencyService
from schemas.response_schemas import OperationHistoryItem, OperationHistoryListResponse, DependencyEdgeItem, DependenciesResponse
from core.constants import EdgeSourceType, EdgeTargetType
from core.auth import get_current_user
from uuid import UUID
from typing import Optional, Union

router = APIRouter(prefix="/api/v1")

@router.get("/history", summary="获取操作历史记录", response_model=ResponseModel[OperationHistoryListResponse])
async def get_operation_history(
    document_id: UUID = None,
    page: int = 1,
    page_size: int = 10,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await EndpointService.get_operation_history(db, page, page_size, document_id=document_id)
    return success_response(data=OperationHistoryListResponse(
        total=total,
        items=[OperationHistoryItem(**item) for item in items]
    ))

# 合并两个枚举的所有值作为路径参数类型
_EntityType = Union[EdgeSourceType, EdgeTargetType]

@router.get("/dependencies/{entity_type}/{entity_id}", summary="获取实体的上下游依赖", response_model=ResponseModel[DependenciesResponse])
async def get_entity_dependencies(entity_type: str, entity_id: UUID, db: AsyncSession = Depends(get_db)):
    all_valid = {e.value for e in EdgeSourceType} | {e.value for e in EdgeTargetType}
    if entity_type not in all_valid:
        raise HTTPException(status_code=400, detail=f"无效的实体类型，支持：{', '.join(sorted(all_valid))}")
    dependencies = await DependencyService.get_dependencies(db, entity_type, entity_id)
    return success_response(data=DependenciesResponse(
        upstream=[DependencyEdgeItem(**e) for e in dependencies["upstream"]],
        downstream=[DependencyEdgeItem(**e) for e in dependencies["downstream"]]
    ))


