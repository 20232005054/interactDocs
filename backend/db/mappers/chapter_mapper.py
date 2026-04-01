from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from db.models import Chapter, Paragraph
from uuid import UUID
from typing import Optional

class ChapterMapper:
    @staticmethod
    async def get_chapters_by_document_id(db: AsyncSession, document_id: UUID):
        result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id).order_by(Chapter.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_chapters_by_parent_id(db: AsyncSession, parent_id: UUID):
        result = await db.execute(
            select(Chapter).where(Chapter.parent_id == parent_id).order_by(Chapter.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_chapter_by_id(db: AsyncSession, chapter_id: UUID):
        result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == chapter_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_chapter(db: AsyncSession, chapter):
        db.add(chapter)
        await db.commit()
        await db.refresh(chapter)
        return chapter

    @staticmethod
    async def update_chapter(db: AsyncSession, chapter_id: UUID, update_data):
        await db.execute(
            update(Chapter)
            .where(Chapter.chapter_id == chapter_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def shift_order_index(
        db: AsyncSession,
        document_id: UUID,
        parent_id: Optional[UUID],
        from_index: int,
        delta: int,
    ) -> None:
        """批量偏移同级章节 order_index >= from_index 的节点"""
        query = (
            update(Chapter)
            .where(Chapter.document_id == document_id)
            .where(Chapter.order_index >= from_index)
        )
        if parent_id is None:
            query = query.where(Chapter.parent_id.is_(None))
        else:
            query = query.where(Chapter.parent_id == parent_id)
        await db.execute(query.values(order_index=Chapter.order_index + delta))

    @staticmethod
    async def batch_update_order(db: AsyncSession, items: list) -> None:
        """批量重写 order_index，items 每项含 chapter_id、order_index，可选 parent_id"""
        for item in items:
            values = {"order_index": item["order_index"]}
            if "parent_id" in item:
                values["parent_id"] = item["parent_id"]
            await db.execute(
                update(Chapter)
                .where(Chapter.chapter_id == item["chapter_id"])
                .values(**values)
            )
        await db.commit()

    @staticmethod
    async def delete_chapter(db: AsyncSession, chapter):
        document_id = chapter.document_id
        parent_id = chapter.parent_id
        deleted_order_index = chapter.order_index

        await db.delete(chapter)
        await db.commit()

        # 被删章节之后的同级章节补位
        query = (
            update(Chapter)
            .where(Chapter.document_id == document_id)
            .where(Chapter.order_index > deleted_order_index)
        )
        if parent_id is None:
            query = query.where(Chapter.parent_id.is_(None))
        else:
            query = query.where(Chapter.parent_id == parent_id)
        await db.execute(query.values(order_index=Chapter.order_index - 1))
        await db.commit()

    @staticmethod
    async def get_chapter_with_paragraphs(db: AsyncSession, chapter_id: UUID):
        result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == chapter_id)
        )
        chapter = result.scalar_one_or_none()

        if chapter:
            para_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = para_result.scalars().all()
            return chapter, paragraphs

        return chapter, []
