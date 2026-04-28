"""
文献 RAG 检索服务

职责：
1. 根据 document_template_id + user_id 检索相关文献分块（pgvector 向量检索）
2. 格式化引用上下文注入 AI prompt
3. 解析 AI 返回内容中的 [1][2] 标记，写入 document_citations 表
"""

import logging
import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from db.mappers.literature_chunk_mapper import LiteratureChunkMapper
from db.mappers.document_citation_mapper import DocumentCitationMapper
from db.models import DocumentCitation
from services.ai_client import get_embedding

logger = logging.getLogger(__name__)


class LiteratureRagService:

    @staticmethod
    async def retrieve_and_format(
        db: AsyncSession,
        document_template_id: UUID,
        user_id: UUID,
        query: str,
        top_k: int = 5,
    ) -> tuple[str, list[dict]]:
        """
        向量检索 + 格式化引用上下文。

        直接通过文档绑定的 template_id（type=0 私有副本）查关联表，
        检索 public 文献 + 当前用户的 private 文献。

        Returns:
            (context_str, citations)
            - context_str: 注入 prompt 的引用上下文字符串，为空则无文献
            - citations: [{"number": 1, "literature_id": UUID, "title": ..., ...}]
        """
        if not query or not query.strip():
            return "", []

        try:
            query_embedding = await get_embedding(query)
        except Exception as e:
            logger.warning("文献检索 embedding 失败，跳过文献注入: %s", e)
            return "", []

        try:
            chunks = await LiteratureChunkMapper.search_by_template_id(
                db, document_template_id, user_id, query_embedding, top_k=top_k
            )
        except Exception as e:
            logger.warning("文献向量检索失败，跳过文献注入: %s", e)
            return "", []

        if not chunks:
            return "", []

        logger.info(
            "[RAG] 检索到 %d 个 chunk，template_id=%s query_len=%d",
            len(chunks), document_template_id, len(query)
        )

        # 去重：同一篇文献只取相似度最高的一个片段
        seen_literature_ids: set = set()
        deduped_chunks = []
        for chunk in chunks:
            lid = chunk["literature_id"]
            if lid not in seen_literature_ids:
                seen_literature_ids.add(lid)
                deduped_chunks.append(chunk)

        # 构建引用列表和上下文字符串
        citations = []
        context_parts = []
        for i, chunk in enumerate(deduped_chunks, start=1):
            title = chunk.get("title") or "未知文献"
            journal = chunk.get("journal") or ""
            publish_date = chunk.get("publish_date")
            year = publish_date.year if publish_date else ""
            doi = chunk.get("doi") or ""

            ref_line = f"[{i}] {title}"
            if journal:
                ref_line += f"（{journal}"
                if year:
                    ref_line += f", {year}"
                ref_line += "）"
            if doi:
                ref_line += f" DOI: {doi}"

            context_parts.append(f"{ref_line}\n{chunk['content']}")
            citations.append({
                "number": i,
                "literature_id": chunk["literature_id"],
                "title": title,
                "journal": journal,
                "publish_date": publish_date,
                "doi": doi,
                "authors": chunk.get("authors") or "",
                "impact_factor": chunk.get("impact_factor"),
            })

        context_str = (
            "【参考文献】\n"
            "以下是相关参考文献片段，请在生成内容时适当引用，"
            "引用格式为 [编号]，如 [1]、[2]。\n\n"
            "**重要约束**：\n"
            "1. 只能引用以下提供的文献，不得编造或添加其他文献\n"
            "2. 不要在生成内容末尾添加参考文献列表或参考文献章节\n"
            "3. 参考文献列表由系统自动管理，你只需在正文中使用 [编号] 标记引用位置即可\n"
            "4. 如果需要引用但以下文献不够，只使用已提供的文献，不要自行补充\n\n"
            + "\n\n".join(context_parts)
        )

        return context_str, citations

    @staticmethod
    def inject_into_prompt(base_prompt: str, context_str: str) -> str:
        """将文献上下文注入到 prompt 末尾"""
        if not context_str:
            return base_prompt
        return f"{base_prompt}\n\n{context_str}"

    @staticmethod
    async def save_citations(
        db: AsyncSession,
        document_id: UUID,
        source_type: str,
        source_id: UUID,
        ai_content: str,
        citations: list[dict],
    ) -> None:
        """
        解析 AI 返回内容中的 [1][2] 标记，写入 document_citations 表。
        先清空该 source 的旧引用，再写入新引用。

        Args:
            source_type: "paragraph" 或 "summary"
            source_id: paragraph_id 或 summary_id
            ai_content: AI 生成的文本内容
            citations: retrieve_and_format 返回的 citations 列表
        """
        if not citations or not ai_content:
            return

        used_numbers = set(int(n) for n in re.findall(r'\[(\d+)\]', ai_content))
        if not used_numbers:
            return

        await DocumentCitationMapper.delete_by_source(db, source_type, source_id)

        new_citations = []
        for c in citations:
            if c["number"] in used_numbers:
                new_citations.append(DocumentCitation(
                    document_id=document_id,
                    source_type=source_type,
                    source_id=source_id,
                    literature_id=c["literature_id"],
                    citation_number=c["number"],
                ))

        if new_citations:
            await DocumentCitationMapper.bulk_create(db, new_citations)
            await db.commit()
            logger.info(
                "保存引用记录 source_type=%s source_id=%s count=%d",
                source_type, source_id, len(new_citations)
            )

    @staticmethod
    async def get_document_reference_list(
        db: AsyncSession,
        document_id: UUID,
    ) -> list[dict]:
        """获取文档的完整参考文献列表（去重，按编号排序），用于导出。"""
        return await DocumentCitationMapper.get_distinct_by_document_id(db, document_id)

    @staticmethod
    def format_vancouver_reference(citation: dict, number: int) -> str:
        """
        格式化为温哥华引文格式：
        [n] 作者. 标题[J]. 期刊, 年份. DOI: xxx
        """
        parts = [f"[{number}]"]

        authors = citation.get("authors") or ""
        if authors:
            parts.append(f"{authors}.")

        title = citation.get("title") or "未知标题"
        parts.append(f"{title}[J].")

        journal = citation.get("journal") or ""
        publish_date = citation.get("publish_date")
        year = publish_date.year if publish_date else ""

        if journal and year:
            parts.append(f"{journal}, {year}.")
        elif journal:
            parts.append(f"{journal}.")
        elif year:
            parts.append(f"{year}.")

        doi = citation.get("doi") or ""
        if doi:
            parts.append(f"DOI: {doi}")

        return " ".join(parts)
