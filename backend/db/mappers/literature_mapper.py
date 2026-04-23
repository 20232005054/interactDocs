from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update as sa_update, delete as sa_delete
from uuid import UUID

from db.models import Literature


class LiteratureMapper:

    @staticmethod
    async def create(db: AsyncSession, literature: Literature) -> Literature:
        db.add(literature)
        await db.flush()
        await db.refresh(literature)
        return literature

    @staticmethod
    async def get_by_id(db: AsyncSession, literature_id: UUID) -> Literature | None:
        result = await db.execute(
            select(Literature).where(Literature.literature_id == literature_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_template_id(db: AsyncSession, template_id: UUID) -> list[Literature]:
        """
        获取模板绑定的所有文献（通过关联表），按创建时间升序。
        """
        from db.models import TemplateLiterature
        result = await db.execute(
            select(Literature)
            .join(TemplateLiterature, Literature.literature_id == TemplateLiterature.literature_id)
            .where(TemplateLiterature.template_id == template_id)
            .order_by(Literature.created_at.asc())
        )
        return result.scalars().all()

    @staticmethod
    async def list_by_user_id(db: AsyncSession, user_id: UUID) -> list[Literature]:
        """获取用户上传的所有私有文献"""
        result = await db.execute(
            select(Literature)
            .where(Literature.user_id == user_id, Literature.scope == "private")
            .order_by(Literature.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def list_public(db: AsyncSession) -> list[Literature]:
        """获取所有公共文献"""
        result = await db.execute(
            select(Literature)
            .where(Literature.scope == "public")
            .order_by(Literature.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def update_status(
        db: AsyncSession,
        literature_id: UUID,
        status: str,
        error_message: str | None = None,
    ) -> None:
        values = {"upload_status": status}
        if error_message is not None:
            values["error_message"] = error_message
        await db.execute(
            sa_update(Literature)
            .where(Literature.literature_id == literature_id)
            .values(**values)
        )

    @staticmethod
    async def update_metadata(db: AsyncSession, literature_id: UUID, metadata: dict) -> None:
        """更新 CrossRef 补全的 metadata 字段"""
        await db.execute(
            sa_update(Literature)
            .where(Literature.literature_id == literature_id)
            .values(**metadata)
        )

    @staticmethod
    async def delete(db: AsyncSession, literature_id: UUID) -> bool:
        result = await db.execute(
            sa_delete(Literature).where(Literature.literature_id == literature_id)
        )
        return result.rowcount > 0

    @staticmethod
    async def find_by_key(db: AsyncSession, literature_key: str) -> Literature | None:
        """按 literature_key 精确查找（跨系统导入时第一优先级匹配）"""
        result = await db.execute(
            select(Literature).where(Literature.literature_key == literature_key)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def find_by_doi(db: AsyncSession, doi: str) -> Literature | None:
        """按 DOI 精确查找（第二优先级匹配）"""
        result = await db.execute(
            select(Literature).where(Literature.doi == doi)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def find_by_title(db: AsyncSession, title: str) -> Literature | None:
        """
        按标题归一化匹配（第三优先级，兜底）。
        归一化：lowercase + 去除首尾空格，做精确匹配。
        """
        from sqlalchemy import func as sa_func
        normalized = title.strip().lower()
        result = await db.execute(
            select(Literature).where(
                sa_func.lower(sa_func.trim(Literature.title)) == normalized
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_orphans(db: AsyncSession) -> list[Literature]:
        """
        获取没有任何模板绑定的孤儿文献（用于 admin 后台清理）。
        """
        from db.models import TemplateLiterature
        from sqlalchemy import outerjoin
        result = await db.execute(
            select(Literature)
            .outerjoin(
                TemplateLiterature,
                Literature.literature_id == TemplateLiterature.literature_id,
            )
            .where(TemplateLiterature.id.is_(None))
            .order_by(Literature.created_at.asc())
        )
        return result.scalars().all()
