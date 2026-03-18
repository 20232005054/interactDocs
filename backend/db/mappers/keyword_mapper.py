from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from db.models import DocumentKeyword
from uuid import UUID

class KeywordMapper:
    @staticmethod
    async def create_keyword(db: AsyncSession, keyword: DocumentKeyword):
        db.add(keyword)
        await db.commit()
        await db.refresh(keyword)
        return keyword

    @staticmethod
    async def get_keyword_by_id(db: AsyncSession, keyword_id: UUID):
        result = await db.execute(
            select(DocumentKeyword).where(DocumentKeyword.keyword_id == keyword_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_keywords_by_document_id(db: AsyncSession, document_id: UUID):
        result = await db.execute(
            select(DocumentKeyword).where(DocumentKeyword.document_id == document_id).order_by(DocumentKeyword.created_at.asc())
        )
        return result.scalars().all()

    @staticmethod
    async def update_keyword(db: AsyncSession, keyword_id: UUID, update_data):
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if not keyword:
            return None
        
        for key, value in update_data.items():
            setattr(keyword, key, value)
        
        await db.commit()
        await db.refresh(keyword)
        return keyword

    @staticmethod
    async def delete_keyword(db: AsyncSession, keyword: DocumentKeyword):
        await db.delete(keyword)
        await db.commit()
