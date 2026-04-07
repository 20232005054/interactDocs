"""
鉴权依赖模块

提供三个 FastAPI Depends 依赖，按权限层级递进：
- get_current_user: 所有登录用户
- get_editor_user:  editor 或 admin
- get_admin_user:   仅 admin
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import UserRole
from core.security import decode_token
from db.session import get_db

# HTTPBearer 方案：Swagger 会显示 Value 输入框，直接粘贴 token
http_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
):
    """获取当前登录用户

    从 Authorization: Bearer <token> 中解析用户信息。
    token 无效或用户不存在时返回 401。
    """
    from db.mappers.user_mapper import UserMapper

    payload = decode_token(credentials.credentials)
    user = await UserMapper.get_by_id(db, payload["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_editor_user(current_user=Depends(get_current_user)):
    """要求 editor 或 admin 角色

    普通 user 调用时返回 403。
    """
    if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要编辑权限",
        )
    return current_user


async def get_admin_user(current_user=Depends(get_current_user)):
    """要求 admin 角色

    非 admin 调用时返回 403。
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user
