from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Chapter, Paragraph
from uuid import UUID

class ChapterMapper:
    @staticmethod
    async def get_chapters_by_document_id(db: AsyncSession, document_id: UUID):
        result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id)
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
        await db.delete(chapter)
        await db.commit()

    @staticmethod
    async def get_chapters_with_paragraphs(db: AsyncSession, document_id: UUID):
        # 获取所有章节
        result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id)
        )
        chapters = result.scalars().all()
        
        # 为每个章节获取段落，并返回章节和段落的列表
        chapter_with_paragraphs = []
        for chapter in chapters:
            para_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = para_result.scalars().all()
            chapter_with_paragraphs.append((chapter, paragraphs))
        
        return chapter_with_paragraphs

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
