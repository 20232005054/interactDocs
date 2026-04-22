"""
认证接口

公开接口（无需登录）：
- POST /register  注册
- POST /login     登录

登录后接口：
- GET  /me        获取当前用户信息
- PUT  /me        更新个人信息
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.auth import get_current_user
from core.response import success_response, ResponseModel
from db.session import get_db
from schemas.user_schemas import UserCreate, UserLogin, UserUpdate, UserPasswordUpdate, Token, User as UserSchema
from services.user_service import UserService

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/register", summary="用户注册", response_model=ResponseModel[Token])
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await UserService.register(db, user_in)
    return success_response(data=Token(**result))


@router.post("/login", summary="用户登录", response_model=ResponseModel[Token])
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await UserService.login(db, user_in)
    return success_response(data=Token(**result))


@router.get("/me", summary="获取当前用户信息", response_model=ResponseModel[UserSchema])
async def get_me(current_user=Depends(get_current_user)):
    return success_response(data=UserSchema(
        user_id=current_user.user_id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
    ))


@router.put("/me", summary="更新个人信息", response_model=ResponseModel[UserSchema])
async def update_me(
    user_in: UserUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await UserService.update_me(db, current_user.user_id, user_in)
    return success_response(data=UserSchema(
        user_id=updated.user_id,
        email=updated.email,
        name=updated.name,
        role=updated.role,
    ))


@router.put("/me/password", summary="修改密码", response_model=ResponseModel[None])
async def change_password(
    password_in: UserPasswordUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await UserService.change_password(
        db, current_user.user_id, password_in.old_password, password_in.new_password
    )
    return success_response(message="密码修改成功")
