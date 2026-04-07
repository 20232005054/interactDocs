from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.response import success_response, ResponseModel
from services.endpoint_service import EndpointService
from services.dependency_service import DependencyService
from schemas.response_schemas import OperationHistoryItem, OperationHistoryListResponse, DependencyEdgeItem, DependenciesResponse
from uuid import UUID

router = APIRouter(prefix="/api/v1")

@router.get("/history", summary="获取操作历史记录", response_model=ResponseModel[OperationHistoryListResponse])
async def get_operation_history(page: int = 1, page_size: int = 10, db: AsyncSession = Depends(get_db)):
    total, items = await EndpointService.get_operation_history(db, page, page_size)
    return success_response(data=OperationHistoryListResponse(
        total=total,
        items=[OperationHistoryItem(**item) for item in items]
    ))

@router.get("/dependencies/{entity_type}/{entity_id}", summary="获取实体的上下游依赖", response_model=ResponseModel[DependenciesResponse])
async def get_entity_dependencies(entity_type: str, entity_id: UUID, db: AsyncSession = Depends(get_db)):
    valid_types = ["paragraph", "summary", "keyword"]
    if entity_type not in valid_types:
        raise HTTPException(status_code=400, detail="无效的实体类型")
    dependencies = await DependencyService.get_dependencies(db, entity_type, entity_id)
    return success_response(data=DependenciesResponse(
        upstream=[DependencyEdgeItem(**e) for e in dependencies["upstream"]],
        downstream=[DependencyEdgeItem(**e) for e in dependencies["downstream"]]
    ))


