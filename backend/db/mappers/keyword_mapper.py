from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from db.models import DocumentKeyword, KeywordSummaryLink, KeywordParagraphLink
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
            select(DocumentKeyword).where(DocumentKeyword.document_id == document_id)
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

    @staticmethod
    async def create_keyword_summary_link(db: AsyncSession, link: KeywordSummaryLink):
        db.add(link)
        await db.commit()
        await db.refresh(link)
        return link

    @staticmethod
    async def create_keyword_paragraph_link(db: AsyncSession, link: KeywordParagraphLink):
        db.add(link)
        await db.commit()
        await db.refresh(link)
        return link

    @staticmethod
    async def get_links_by_keyword_id(db: AsyncSession, keyword_id: UUID):
        result = await db.execute(
            select(KeywordSummaryLink).where(KeywordSummaryLink.keyword_id == keyword_id)
        )
        summary_links = result.scalars().all()
        
        result = await db.execute(
            select(KeywordParagraphLink).where(KeywordParagraphLink.keyword_id == keyword_id)
        )
        paragraph_links = result.scalars().all()
        
        return summary_links, paragraph_links

    @staticmethod
    async def get_links_by_summary_id(db: AsyncSession, summary_id: UUID):
        result = await db.execute(
            select(KeywordSummaryLink).where(KeywordSummaryLink.summary_id == summary_id)
        )
        return result.scalars().all()

    @staticmethod
    async def get_links_by_paragraph_id(db: AsyncSession, paragraph_id: UUID):
        result = await db.execute(
            select(KeywordParagraphLink).where(KeywordParagraphLink.paragraph_id == paragraph_id)
        )
        return result.scalars().all()

    @staticmethod
    async def update_link(db: AsyncSession, link_id: UUID, update_data):
        # 这里需要根据link_id判断是哪种类型的链接
        # 简化处理，实际项目中可能需要更复杂的逻辑
        pass
