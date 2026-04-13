from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from db.models import Paragraph
from uuid import UUID

class ParagraphMapper:
    @staticmethod
    async def get_paragraphs_by_document_id(db: AsyncSession, document_id: UUID):
        """一次查出文档下所有段落，避免 N+1"""
        from db.models import Chapter
        result = await db.execute(
            select(Paragraph)
            .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
            .where(Chapter.document_id == document_id)
            .order_by(Paragraph.chapter_id, Paragraph.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_paragraphs_by_chapter_id(db: AsyncSession, chapter_id: UUID):
        result = await db.execute(
            select(Paragraph).where(Paragraph.chapter_id == chapter_id).order_by(Paragraph.order_index)
        )
        return result.scalars().all()

    @staticmethod
    async def get_paragraph_by_id(db: AsyncSession, paragraph_id: UUID):
        result = await db.execute(
            select(Paragraph).where(Paragraph.paragraph_id == paragraph_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_paragraph(db: AsyncSession, paragraph):
        db.add(paragraph)
        await db.commit()
        await db.refresh(paragraph)
        return paragraph

    @staticmethod
    async def update_paragraph(db: AsyncSession, paragraph_id: UUID, update_data):
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def shift_order_index(
        db: AsyncSession, chapter_id: UUID, from_index: int, delta: int
    ) -> None:
        """批量偏移 chapter_id 下 order_index >= from_index 的段落"""
        await db.execute(
            update(Paragraph)
            .where(Paragraph.chapter_id == chapter_id)
            .where(Paragraph.order_index >= from_index)
            .values(order_index=Paragraph.order_index + delta)
        )

    @staticmethod
    async def delete_paragraph(db: AsyncSession, paragraph):
        await db.delete(paragraph)
        await db.commit()

    @staticmethod
    async def get_heading_paragraphs(db: AsyncSession, chapter_id: UUID):
        result = await db.execute(
            select(Paragraph)
            .where(
                Paragraph.chapter_id == chapter_id,
                Paragraph.para_type.in_(['heading-1', 'heading-2', 'heading-3'])
            )
            .order_by(Paragraph.order_index)
        )
        return result.scalars().all()
