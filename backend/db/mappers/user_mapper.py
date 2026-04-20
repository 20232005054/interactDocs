"""
用户数据库操作 Mapper

封装所有对 users 表的 CRUD 操作。
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID

from db.models import User


class UserMapper:

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str | UUID) -> User | None:
        """通过 user_id 查询用户"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        """通过邮箱查询用户（用于登录校验）"""
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, user: User) -> User:
        """创建新用户"""
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def update(db: AsyncSession, user_id: UUID, update_data: dict) -> User | None:
        """更新用户信息"""
        from sqlalchemy import update
        await db.execute(
            update(User).where(User.user_id == user_id).values(**update_data)
        )
        return await UserMapper.get_by_id(db, user_id)

    @staticmethod
    async def delete(db: AsyncSession, user_id: UUID) -> bool:
        """删除用户"""
        from sqlalchemy import delete
        result = await db.execute(
            delete(User).where(User.user_id == user_id)
        )
        return result.rowcount > 0

    @staticmethod
    async def list_all(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        keyword: str = None,
        role: str = None,
    ):
        """分页查询所有用户（admin 用），支持关键词搜索和角色过滤"""
        from sqlalchemy import func, or_

        query = select(User)
        count_query = select(func.count()).select_from(User)

        if keyword:
            like = f"%{keyword}%"
            condition = or_(User.email.ilike(like), User.name.ilike(like))
            query = query.where(condition)
            count_query = count_query.where(condition)

        if role:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)

        total = (await db.execute(count_query)).scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
        )
        users = result.scalars().all()
        return total, users
