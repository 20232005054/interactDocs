from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Paragraph
from uuid import UUID

class ParagraphMapper:
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
        from sqlalchemy import update
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(**update_data)
        )
        await db.commit()

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
