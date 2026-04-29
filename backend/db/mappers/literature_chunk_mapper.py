from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete, text
from uuid import UUID
from typing import List

from db.models import LiteratureChunk


class LiteratureChunkMapper:

    @staticmethod
    async def bulk_create(db: AsyncSession, chunks: list[LiteratureChunk]) -> None:
        """批量写入分块，flush 后由 service 层统一 commit"""
        for chunk in chunks:
            db.add(chunk)
        await db.flush()

    @staticmethod
    async def delete_by_literature_id(db: AsyncSession, literature_id: UUID) -> None:
        """删除文献的所有分块（重新处理时先清空）"""
        await db.execute(
            sa_delete(LiteratureChunk)
            .where(LiteratureChunk.literature_id == literature_id)
        )

    @staticmethod
    async def search_by_template_id(
        db: AsyncSession,
        template_id: UUID,
        user_id: UUID,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """
        向量相似度检索。
        直接通过 template_id（文档私有副本的 template_id）查关联表，
        检索该模板绑定的文献分块：
          - scope='public' 的文献对所有人可见
          - scope='private' 的文献只对上传者（user_id）可见
        返回 top_k 个最相关片段，含 literature 主表信息。
        """
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
        sql = text("""
            SELECT
                lc.chunk_id,
                lc.literature_id,
                lc.section_type,
                lc.content,
                lc.chunk_index,
                1 - (lc.embedding <=> :embedding ::vector) AS similarity,
                l.title,
                l.authors,
                l.journal,
                l.publish_date,
                l.doi,
                l.impact_factor
            FROM literature_chunks lc
            JOIN literature l ON lc.literature_id = l.literature_id
            JOIN template_literature tl ON l.literature_id = tl.literature_id
            WHERE tl.template_id = :template_id
              AND (
                  l.scope = 'public'
                  OR (l.scope = 'private' AND l.user_id = :user_id)
              )
              AND l.upload_status = 'ready'
            ORDER BY lc.embedding <=> :embedding ::vector
            LIMIT :top_k
        """)
        result = await db.execute(sql, {
            "embedding": embedding_str,
            "template_id": str(template_id),
            "user_id": str(user_id),
            "top_k": top_k,
        })
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    @staticmethod
    async def count_by_literature_id(db: AsyncSession, literature_id: UUID) -> int:
        """统计文献的分块数量，用于验证处理结果"""
        result = await db.execute(
            select(LiteratureChunk)
            .where(LiteratureChunk.literature_id == literature_id)
        )
        return len(result.scalars().all())

    @staticmethod
    async def search_by_paragraph_id(
        db: AsyncSession,
        paragraph_id: UUID,
        user_id: UUID,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[dict]:
        """
        向量相似度检索（段落级）。
        检索该段落绑定的文献分块：
          - scope='public' 的文献对所有人可见
          - scope='private' 的文献只对上传者（user_id）可见
        返回 top_k 个最相关片段，含 literature 主表信息。
        """
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
        sql = text("""
            SELECT
                lc.chunk_id,
                lc.literature_id,
                lc.section_type,
                lc.content,
                lc.chunk_index,
                1 - (lc.embedding <=> :embedding ::vector) AS similarity,
                l.title,
                l.authors,
                l.journal,
                l.publish_date,
                l.doi,
                l.impact_factor
            FROM literature_chunks lc
            JOIN literature l ON lc.literature_id = l.literature_id
            JOIN paragraph_literature pl ON l.literature_id = pl.literature_id
            WHERE pl.paragraph_id = :paragraph_id
              AND (
                  l.scope = 'public'
                  OR (l.scope = 'private' AND l.user_id = :user_id)
              )
              AND l.upload_status = 'ready'
            ORDER BY lc.embedding <=> :embedding ::vector
            LIMIT :top_k
        """)
        result = await db.execute(sql, {
            "embedding": embedding_str,
            "paragraph_id": str(paragraph_id),
            "user_id": str(user_id),
            "top_k": top_k,
        })
        rows = result.mappings().all()
        return [dict(row) for row in rows]
