from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.response import success_response
from services.endpoint_service import EndpointService

router = APIRouter(prefix="/api/v1")

# --- 辅助功能模块 ---
@router.get("/history", summary="获取操作历史记录")
async def get_operation_history(page: int = 1, page_size: int = 10, db: AsyncSession = Depends(get_db)):
    """
    获取操作历史记录
    """
    total, items = await EndpointService.get_operation_history(db, page, page_size)
    return success_response(data={"total": total, "items": items})


