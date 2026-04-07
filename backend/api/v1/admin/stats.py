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
    from sqlalchemy import func, select
    from db.models import User, Document, Template

    user_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    doc_count = (await db.execute(select(func.count()).select_from(Document))).scalar_one()
    tpl_count = (await db.execute(
        select(func.count()).select_from(Template).where(Template.is_system == True)
    )).scalar_one()

    return success_response(data=StatsOverview(
        total_users=user_count,
        total_documents=doc_count,
        total_templates=tpl_count,
    ))
