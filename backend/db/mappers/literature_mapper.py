from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update as sa_update, delete as sa_delete, func
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
        """获取模板下所有文献，按创建时间升序"""
        result = await db.execute(
            select(Literature)
            .where(Literature.template_id == template_id)
            .order_by(Literature.created_at.asc())
        )
        return result.scalars().all()

    @staticmethod
    async def list_ready_by_group_id(db: AsyncSession, group_id: UUID) -> list[Literature]:
        """
        通过 group_id 找到原始模板（type=1/2），返回其下所有 ready 状态的文献。
        用于 AI 生成时检索文献（文档绑定的是私有副本，通过 group_id 关联原始模板）。
        """
        from db.models import Template
        result = await db.execute(
            select(Literature)
            .join(Template, Literature.template_id == Template.template_id)
            .where(
                Template.group_id == group_id,
                Template.template_type.in_([1, 2]),
                Literature.upload_status == "ready",
            )
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
