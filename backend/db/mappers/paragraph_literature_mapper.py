"""
段落-文献关联 Mapper

职责：
1. 绑定/解绑文献到段落
2. 查询段落绑定的文献列表
3. 统计文献被引用次数
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from uuid import UUID

from db.models import ParagraphLiterature, Literature


class ParagraphLiteratureMapper:

    @staticmethod
    async def bind(db: AsyncSession, paragraph_id: UUID, literature_id: UUID) -> None:
        """
        绑定文献到段落（幂等操作）
        使用 ON CONFLICT DO NOTHING 避免重复绑定
        """
        stmt = pg_insert(ParagraphLiterature).values(
            paragraph_id=paragraph_id,
            literature_id=literature_id,
        ).on_conflict_do_nothing(
            index_elements=["paragraph_id", "literature_id"]
        )
        await db.execute(stmt)
        await db.flush()

    @staticmethod
    async def unbind(db: AsyncSession, paragraph_id: UUID, literature_id: UUID) -> bool:
        """
        解绑文献与段落
        
        Returns:
            bool: 是否成功解绑（True=解绑成功，False=绑定关系不存在）
        """
        result = await db.execute(
            sa_delete(ParagraphLiterature).where(
                ParagraphLiterature.paragraph_id == paragraph_id,
                ParagraphLiterature.literature_id == literature_id,
            )
        )
        return result.rowcount > 0

    @staticmethod
    async def list_by_paragraph_id(db: AsyncSession, paragraph_id: UUID) -> list[Literature]:
        """
        获取段落绑定的所有文献（按绑定时间升序）
        
        Returns:
            list[Literature]: 文献列表
        """
        result = await db.execute(
            select(Literature)
            .join(ParagraphLiterature, Literature.literature_id == ParagraphLiterature.literature_id)
            .where(ParagraphLiterature.paragraph_id == paragraph_id)
            .order_by(ParagraphLiterature.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete_by_paragraph_id(db: AsyncSession, paragraph_id: UUID) -> int:
        """
        删除段落的所有文献绑定（段落删除时级联调用）
        
        Returns:
            int: 删除的绑定记录数量
        """
        result = await db.execute(
            sa_delete(ParagraphLiterature).where(
                ParagraphLiterature.paragraph_id == paragraph_id
            )
        )
        return result.rowcount

    @staticmethod
    async def count_by_literature_id(db: AsyncSession, literature_id: UUID) -> int:
        """
        统计文献被多少个段落引用（删除文献前检查）
        
        Returns:
            int: 引用该文献的段落数量
        """
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(ParagraphLiterature.id)).where(
                ParagraphLiterature.literature_id == literature_id
            )
        )
        return result.scalar() or 0

    @staticmethod
    async def is_bound(db: AsyncSession, paragraph_id: UUID, literature_id: UUID) -> bool:
        """
        检查段落是否已绑定某文献
        
        Returns:
            bool: True=已绑定，False=未绑定
        """
        result = await db.execute(
            select(ParagraphLiterature).where(
                ParagraphLiterature.paragraph_id == paragraph_id,
                ParagraphLiterature.literature_id == literature_id,
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def list_paragraphs_by_literature_id(db: AsyncSession, literature_id: UUID) -> list[UUID]:
        """
        获取引用了某文献的所有段落ID列表
        
        Returns:
            list[UUID]: 段落ID列表
        """
        result = await db.execute(
            select(ParagraphLiterature.paragraph_id).where(
                ParagraphLiterature.literature_id == literature_id
            ).order_by(ParagraphLiterature.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_by_document_id(db: AsyncSession, document_id: UUID) -> list[dict]:
        """
        批量查询文档所有段落的文献绑定关系（避免 N+1 查询）
        
        Returns:
            list[dict]: 绑定关系列表，每项包含：
                - paragraph_id: UUID
                - chapter_id: UUID
                - chapter_title: str
                - paragraph_content: str (截取前100字符)
                - paragraph_order: int
                - literature_id: UUID
                - literature_title: str
                - literature_authors: str
                - literature_journal: str
                - literature_doi: str
        """
        from db.models import Paragraph, Chapter
        
        result = await db.execute(
            select(
                ParagraphLiterature.paragraph_id,
                Paragraph.chapter_id,
                Chapter.title.label("chapter_title"),
                Paragraph.content,
                Paragraph.order_index.label("paragraph_order"),
                Literature.literature_id,
                Literature.title.label("literature_title"),
                Literature.authors.label("literature_authors"),
                Literature.journal.label("literature_journal"),
                Literature.doi.label("literature_doi"),
            )
            .join(Paragraph, ParagraphLiterature.paragraph_id == Paragraph.paragraph_id)
            .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
            .join(Literature, ParagraphLiterature.literature_id == Literature.literature_id)
            .where(Chapter.document_id == document_id)
            .order_by(Chapter.order_index.asc(), Paragraph.order_index.asc())
        )
        
        rows = result.all()
        return [
            {
                "paragraph_id": str(row.paragraph_id),
                "chapter_id": str(row.chapter_id),
                "chapter_title": row.chapter_title,
                "paragraph_content": row.content[:100] + "..." if len(row.content) > 100 else row.content,
                "paragraph_order": row.paragraph_order,
                "literature_id": str(row.literature_id),
                "literature_title": row.literature_title,
                "literature_authors": row.literature_authors,
                "literature_journal": row.literature_journal,
                "literature_doi": row.literature_doi,
            }
            for row in rows
        ]
