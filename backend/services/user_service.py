"""
用户业务逻辑服务

提供：
- 注册：校验邮箱唯一性，哈希密码，创建用户
- 登录：验证邮箱密码，返回 JWT token
- 更新个人信息
"""

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from db.models import User
from db.mappers.user_mapper import UserMapper
from core.constants import UserRole
from core.security import hash_password, verify_password, create_access_token
from schemas.schemas import UserCreate, UserLogin, UserUpdate


class UserService:

    @staticmethod
    async def register(db: AsyncSession, user_in: UserCreate) -> dict:
        """注册新用户

        Args:
            db: 数据库会话
            user_in: 注册信息（email, name, password）

        Returns:
            包含 access_token 和用户信息的字典

        Raises:
            HTTPException 400: 邮箱已被注册
        """
        # 检查邮箱唯一性
        existing = await UserMapper.get_by_email(db, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被注册",
            )

        # 创建用户，默认角色为 user
        new_user = User(
            email=user_in.email,
            name=user_in.name,
            password_hash=hash_password(user_in.password),
            role=UserRole.USER,
        )
        user = await UserMapper.create(db, new_user)

        # 生成 token
        token = create_access_token(user.user_id, user.role)
        return {"access_token": token, "token_type": "bearer", "user_id": user.user_id}

    @staticmethod
    async def login(db: AsyncSession, user_in: UserLogin) -> dict:
        """用户登录

        Args:
            db: 数据库会话
            user_in: 登录信息（email, password）

        Returns:
            包含 access_token 和用户信息的字典

        Raises:
            HTTPException 401: 邮箱或密码错误
        """
        user = await UserMapper.get_by_email(db, user_in.email)
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(user.user_id, user.role)
        return {"access_token": token, "token_type": "bearer", "user_id": user.user_id}

    @staticmethod
    async def update_me(db: AsyncSession, user_id, user_in: UserUpdate) -> User:
        """更新当前用户个人信息（仅 name）"""
        update_data = user_in.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="没有要更新的数据")
        return await UserMapper.update(db, user_id, update_data)

    @staticmethod
    async def update_role(db: AsyncSession, user_id, new_role: UserRole) -> User:
        """更新用户角色（仅 admin 可调用）"""
        user = await UserMapper.get_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        return await UserMapper.update(db, user_id, {"role": new_role})

    @staticmethod
    async def delete_user(db: AsyncSession, user_id) -> None:
        """删除用户（仅 admin 可调用）"""
        user = await UserMapper.get_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        await UserMapper.delete(db, user_id)
