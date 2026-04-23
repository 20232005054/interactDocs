from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete
from uuid import UUID, uuid4

from db.models import TemplateLiterature


class TemplateLiteratureMapper:

    @staticmethod
    async def bind(db: AsyncSession, template_id: UUID, literature_id: UUID) -> TemplateLiterature:
        """绑定文献到模板，已存在则直接返回"""
        existing = await db.execute(
            select(TemplateLiterature).where(
                TemplateLiterature.template_id == template_id,
                TemplateLiterature.literature_id == literature_id,
            )
        )
        record = existing.scalar_one_or_none()
        if record:
            return record
        record = TemplateLiterature(
            id=uuid4(),
            template_id=template_id,
            literature_id=literature_id,
        )
        db.add(record)
        await db.flush()
        return record

    @staticmethod
    async def unbind(db: AsyncSession, template_id: UUID, literature_id: UUID) -> bool:
        """解绑文献与模板，返回是否实际删除"""
        result = await db.execute(
            sa_delete(TemplateLiterature).where(
                TemplateLiterature.template_id == template_id,
                TemplateLiterature.literature_id == literature_id,
            )
        )
        return result.rowcount > 0

    @staticmethod
    async def list_by_template_id(db: AsyncSession, template_id: UUID) -> list[TemplateLiterature]:
        """获取模板绑定的所有文献关联记录"""
        result = await db.execute(
            select(TemplateLiterature).where(
                TemplateLiterature.template_id == template_id
            ).order_by(TemplateLiterature.created_at.asc())
        )
        return result.scalars().all()

    @staticmethod
    async def list_literature_ids_by_template_id(db: AsyncSession, template_id: UUID) -> list[UUID]:
        """获取模板绑定的所有 literature_id 列表"""
        result = await db.execute(
            select(TemplateLiterature.literature_id).where(
                TemplateLiterature.template_id == template_id
            )
        )
        return result.scalars().all()

    @staticmethod
    async def count_by_literature_id(db: AsyncSession, literature_id: UUID) -> int:
        """统计文献被绑定到多少个模板（用于判断是否为孤儿文献）"""
        result = await db.execute(
            select(TemplateLiterature).where(
                TemplateLiterature.literature_id == literature_id
            )
        )
        return len(result.scalars().all())

    @staticmethod
    async def delete_by_template_id(db: AsyncSession, template_id: UUID) -> None:
        """删除模板的所有文献绑定关系（sync-template 时先清空 public 绑定）"""
        await db.execute(
            sa_delete(TemplateLiterature).where(
                TemplateLiterature.template_id == template_id
            )
        )

    @staticmethod
    async def delete_public_by_template_id(db: AsyncSession, template_id: UUID, user_id: UUID) -> None:
        """
        删除模板下的 public 文献绑定关系，保留当前用户的 private 文献绑定。
        用于 sync-template 时重置公共文献，不影响用户自己上传的私有文献。
        """
        from db.models import Literature
        # 找出该模板下所有 public 文献的关联记录
        result = await db.execute(
            select(TemplateLiterature)
            .join(Literature, TemplateLiterature.literature_id == Literature.literature_id)
            .where(
                TemplateLiterature.template_id == template_id,
                Literature.scope == "public",
            )
        )
        records = result.scalars().all()
        for record in records:
            await db.delete(record)

    @staticmethod
    async def copy_bindings(
        db: AsyncSession,
        source_template_id: UUID,
        target_template_id: UUID,
    ) -> int:
        """
        将 source 模板的所有文献绑定关系复制到 target 模板。
        用于创建文档时深拷贝，以及 sync-template 时同步公共文献。
        返回复制的记录数。
        """
        source_ids = await TemplateLiteratureMapper.list_literature_ids_by_template_id(
            db, source_template_id
        )
        count = 0
        for lit_id in source_ids:
            existing = await db.execute(
                select(TemplateLiterature).where(
                    TemplateLiterature.template_id == target_template_id,
                    TemplateLiterature.literature_id == lit_id,
                )
            )
            if not existing.scalar_one_or_none():
                db.add(TemplateLiterature(
                    id=uuid4(),
                    template_id=target_template_id,
                    literature_id=lit_id,
                ))
                count += 1
        if count:
            await db.flush()
        return count
