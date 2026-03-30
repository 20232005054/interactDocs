from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Chapter, Paragraph
from uuid import UUID

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
        from sqlalchemy import update
        await db.execute(
            update(Chapter)
            .where(Chapter.chapter_id == chapter_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def delete_chapter(db: AsyncSession, chapter):
        document_id = chapter.document_id
        parent_id = chapter.parent_id
        deleted_order_index = chapter.order_index

        await db.delete(chapter)
        await db.commit()

        # 严格维护：将被删章节之后的所有同级章节的 order_index 减 1
        from sqlalchemy import update
        if parent_id is None:
            await db.execute(
                update(Chapter)
                .where(Chapter.document_id == document_id)
                .where(Chapter.parent_id == None)
                .where(Chapter.order_index > deleted_order_index)
                .values(order_index=Chapter.order_index - 1)
            )
        else:
            await db.execute(
                update(Chapter)
                .where(Chapter.document_id == document_id)
                .where(Chapter.parent_id == parent_id)
                .where(Chapter.order_index > deleted_order_index)
                .values(order_index=Chapter.order_index - 1)
            )
        await db.commit()

    @staticmethod
    async def get_chapter_with_paragraphs(db: AsyncSession, chapter_id: UUID):
        # 先获取章节
        result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        
        if chapter:
            # 获取段落
            para_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = para_result.scalars().all()
            
            # 直接返回章节和段落，而不是设置关系
            return chapter, paragraphs
        
        return chapter, []
