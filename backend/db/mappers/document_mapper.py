from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Document
from uuid import UUID

class DocumentMapper:
    @staticmethod
    async def get_document_by_id(db: AsyncSession, document_id: UUID):
        result = await db.execute(
            select(Document).where(Document.document_id == document_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_documents_by_user_id(db: AsyncSession, user_id: UUID):
        result = await db.execute(
            select(Document).where(Document.user_id == user_id)
        )
        return result.scalars().all()

    @staticmethod
    async def create_document(db: AsyncSession, document):
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document

    @staticmethod
    async def update_document(db: AsyncSession, document_id: UUID, update_data):
        from sqlalchemy import update
        await db.execute(
            update(Document)
            .where(Document.document_id == document_id)
            .values(**update_data)
        )
        await db.commit()

    @staticmethod
    async def delete_document(db: AsyncSession, document):
        await db.delete(document)
        await db.commit()
