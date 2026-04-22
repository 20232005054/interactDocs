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
    async def search_by_group_id(
        db: AsyncSession,
        group_id: UUID,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """
        向量相似度检索。
        通过 group_id 关联原始模板（type=1/2），只检索 ready 状态的文献分块。
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
            JOIN templates t ON l.template_id = t.template_id
            WHERE t.group_id = :group_id
              AND t.template_type IN (1, 2)
              AND l.upload_status = 'ready'
            ORDER BY lc.embedding <=> :embedding ::vector
            LIMIT :top_k
        """)
        result = await db.execute(sql, {
            "embedding": embedding_str,
            "group_id": str(group_id),
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
