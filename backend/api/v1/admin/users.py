"""
管理员 - 用户管理接口

所有接口需要 admin 角色。

- GET  /users              分页查询所有用户
- GET  /users/{id}         查询指定用户
- PUT  /users/{id}/role    修改用户角色
- DELETE /users/{id}       删除用户
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from core.auth import get_admin_user
from core.constants import UserRole
from core.response import success_response, ResponseModel
from db.session import get_db
from services.admin_service import AdminService
from services.user_service import UserService
from schemas.user_schemas import User as UserSchema

router = APIRouter(prefix="/api/v1/admin/users", tags=["管理员-用户管理"])


class UserListResponse(BaseModel):
    total: int
    items: list[UserSchema]


class RoleUpdate(BaseModel):
    role: UserRole


@router.get("", summary="查询所有用户", response_model=ResponseModel[UserListResponse])
async def list_users(
    page: int = 1,
    page_size: int = 20,
    keyword: str = None,
    role: str = None,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total, users = await AdminService.list_users(db, page, page_size, keyword=keyword, role=role)
    return success_response(data=UserListResponse(
        total=total,
        items=[UserSchema(user_id=u.user_id, email=u.email, name=u.name, role=u.role) for u in users]
    ))


@router.get("/{user_id}", summary="查询指定用户", response_model=ResponseModel[UserSchema])
async def get_user(
    user_id: UUID,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await AdminService.get_user(db, user_id)
    return success_response(data=UserSchema(user_id=user.user_id, email=user.email, name=user.name, role=user.role))


@router.put("/{user_id}/role", summary="修改用户角色", response_model=ResponseModel[UserSchema])
async def update_role(
    user_id: UUID,
    role_in: RoleUpdate,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await UserService.update_role(db, user_id, role_in.role)
    return success_response(data=UserSchema(user_id=updated.user_id, email=updated.email, name=updated.name, role=updated.role))


@router.delete("/{user_id}", summary="删除用户", response_model=ResponseModel[None])
async def delete_user(
    user_id: UUID,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    await UserService.delete_user(db, user_id)
    return success_response(message="删除成功")
