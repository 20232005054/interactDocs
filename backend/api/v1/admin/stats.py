"""
管理员 - 数据统计接口

所有接口需要 admin 角色。

- GET /stats/overview   总览数据（用户数、文档数等）
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.auth import get_admin_user
from core.response import success_response, ResponseModel
from db.session import get_db
from services.admin_service import AdminService

router = APIRouter(prefix="/api/v1/admin/stats", tags=["管理员-数据统计"])


class StatsOverview(BaseModel):
    total_users: int
    total_documents: int
    total_templates: int


@router.get("/overview", summary="总览统计", response_model=ResponseModel[StatsOverview])
async def get_overview(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """返回系统总览数据"""
    data = await AdminService.get_overview(db)
    return success_response(data=StatsOverview(**data))
