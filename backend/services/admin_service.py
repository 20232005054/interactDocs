"""
管理员业务逻辑服务

提供：
- 系统总览统计（用户数、文档数、系统模板数）
- 用户列表查询、单用户查询
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User, Document, Template
from db.mappers.user_mapper import UserMapper
from fastapi import HTTPException


class AdminService:

    @staticmethod
    async def get_overview(db: AsyncSession) -> dict:
        """返回系统总览统计数据"""
        user_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        doc_count = (await db.execute(select(func.count()).select_from(Document))).scalar_one()
        tpl_count = (await db.execute(
            select(func.count()).select_from(Template).where(Template.template_type == 1)
        )).scalar_one()
        return {
            "total_users": user_count,
            "total_documents": doc_count,
            "total_templates": tpl_count,
        }

    @staticmethod
    async def list_users(
        db: AsyncSession,
        page: int,
        page_size: int,
        keyword: str = None,
        role: str = None,
    ):
        """分页查询所有用户，支持关键词和角色过滤"""
        return await UserMapper.list_all(db, page, page_size, keyword=keyword, role=role)

    @staticmethod
    async def get_user(db: AsyncSession, user_id):
        """查询指定用户，不存在时抛 404"""
        user = await UserMapper.get_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        return user
