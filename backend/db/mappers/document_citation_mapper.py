from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete
from uuid import UUID

from db.models import DocumentCitation


class DocumentCitationMapper:

    @staticmethod
    async def bulk_create(db: AsyncSession, citations: list[DocumentCitation]) -> None:
        """批量写入引用记录"""
        for c in citations:
            db.add(c)
        await db.flush()

    @staticmethod
    async def delete_by_source(
        db: AsyncSession,
        source_type: str,
        source_id: UUID,
    ) -> None:
        """删除某个段落/摘要的所有引用（重新生成时先清空）"""
        await db.execute(
            sa_delete(DocumentCitation)
            .where(
                DocumentCitation.source_type == source_type,
                DocumentCitation.source_id == source_id,
            )
        )

    @staticmethod
    async def get_by_document_id(
        db: AsyncSession,
        document_id: UUID,
    ) -> list[DocumentCitation]:
        """获取文档内所有引用，用于导出时生成参考文献列表"""
        result = await db.execute(
            select(DocumentCitation)
            .where(DocumentCitation.document_id == document_id)
            .order_by(DocumentCitation.citation_number.asc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_distinct_by_document_id(
        db: AsyncSession,
        document_id: UUID,
    ) -> list[dict]:
        """
        获取文档内去重后的引用列表（按 citation_number 排序），
        用于导出时生成参考文献列表。
        """
        from sqlalchemy import text
        sql = text("""
            SELECT DISTINCT ON (dc.citation_number)
                dc.citation_number,
                dc.literature_id,
                l.title,
                l.authors,
                l.journal,
                l.publish_date,
                l.doi,
                l.impact_factor
            FROM document_citations dc
            JOIN literature l ON dc.literature_id = l.literature_id
            WHERE dc.document_id = :document_id
            ORDER BY dc.citation_number ASC
        """)
        result = await db.execute(sql, {"document_id": str(document_id)})
        return [dict(row) for row in result.mappings().all()]
