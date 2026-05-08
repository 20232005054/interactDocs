"""
文献 RAG 检索服务

使用 LangChain 框架实现文献检索和引用功能
"""

import logging
import re
from typing import List, Dict, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from services.langchain.core.vector_stores import LiteratureVectorStore
from services.langchain.chains.rag_chain import create_rag_chain

logger = logging.getLogger(__name__)


class LiteratureRagService:
    """
    文献 RAG 检索服务
    
    使用 LangChain 框架实现：
    - LiteratureVectorStore 向量检索
    - LiteratureRAGChain RAG 链
    - 两级检索策略（段落级 + 模板级）
    """
    
    @staticmethod
    async def retrieve_and_format(
        db: AsyncSession,
        document_template_id: UUID,
        user_id: UUID,
        query: str,
        top_k: int = 5,
    ) -> Tuple[str, List[Dict]]:
        """
        向量检索 + 格式化引用上下文（模板级）
        
        Args:
            db: 数据库会话
            document_template_id: 文档模板 ID
            user_id: 用户 ID
            query: 查询文本
            top_k: 返回数量
        
        Returns:
            (context_str, citations)
        """
        if not query or not query.strip():
            return "", []
        
        try:
            # 使用 LiteratureRAGChain
            chain = create_rag_chain()
            
            # 准备输入
            input_data = {
                "query": query,
                "template_id": str(document_template_id),
                "user_id": str(user_id),
                "top_k": top_k,
                "level": "template",  # 模板级检索
            }
            
            # 执行检索
            result = await chain.ainvoke(input_data)
            
            context_str = result.get("context", "")
            citations = result.get("citations", [])
            
            logger.info(
                f"[RAG-v2-模板] 检索到 {len(citations)} 篇文献 "
                f"template_id={document_template_id}"
            )
            
            return context_str, citations
        
        except Exception as e:
            logger.warning(f"[RAG-v2-模板] 检索失败: {e}")
            return "", []
    
    @staticmethod
    async def retrieve_and_format_for_paragraph(
        db: AsyncSession,
        paragraph_id: UUID,
        document_template_id: UUID,
        user_id: UUID,
        query: str,
        top_k: int = 5,
    ) -> Tuple[str, List[Dict]]:
        """
        两级检索策略（段落级）
        
        Args:
            db: 数据库会话
            paragraph_id: 段落 ID
            document_template_id: 文档模板 ID
            user_id: 用户 ID
            query: 查询文本
            top_k: 返回数量
        
        Returns:
            (context_str, citations)
        """
        if not query or not query.strip():
            return "", []
        
        try:
            # 使用 LiteratureRAGChain
            chain = create_rag_chain()
            
            # 准备输入
            input_data = {
                "query": query,
                "template_id": str(document_template_id),
                "user_id": str(user_id),
                "paragraph_id": str(paragraph_id),
                "top_k": top_k,
                "level": "paragraph",  # 段落级检索
            }
            
            # 执行检索
            result = await chain.ainvoke(input_data)
            
            context_str = result.get("context", "")
            citations = result.get("citations", [])
            
            logger.info(
                f"[RAG-v2-段落] 检索到 {len(citations)} 篇文献 "
                f"paragraph_id={paragraph_id}"
            )
            
            return context_str, citations
        
        except Exception as e:
            logger.warning(f"[RAG-v2-段落] 检索失败: {e}")
            return "", []
    
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
        citations: List[Dict],
    ) -> None:
        """
        解析 AI 返回内容中的 [1][2] 标记，写入 document_citations 表
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
            source_type: "paragraph" 或 "summary"
            source_id: paragraph_id 或 summary_id
            ai_content: AI 生成的文本内容
            citations: retrieve_and_format 返回的 citations 列表
        """
        if not citations or not ai_content:
            return
        
        # 提取使用的引用编号
        used_numbers = set(int(n) for n in re.findall(r'\[(\d+)\]', ai_content))
        if not used_numbers:
            return
        
        # 删除旧引用
        from db.mappers.document_citation_mapper import DocumentCitationMapper
        await DocumentCitationMapper.delete_by_source(db, source_type, source_id)
        
        # 创建新引用
        from db.models import DocumentCitation
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
                f"[RAG-v2] 保存引用记录 source_type={source_type} "
                f"source_id={source_id} count={len(new_citations)}"
            )
    
    @staticmethod
    async def get_document_reference_list(
        db: AsyncSession,
        document_id: UUID,
    ) -> List[Dict]:
        """获取文档的完整参考文献列表（去重，按编号排序）"""
        from db.mappers.document_citation_mapper import DocumentCitationMapper
        return await DocumentCitationMapper.get_distinct_by_document_id(db, document_id)
    
    @staticmethod
    def format_vancouver_reference(citation: Dict, number: int) -> str:
        """
        格式化为温哥华引文格式
        
        Args:
            citation: 引用信息
            number: 引用编号
        
        Returns:
            格式化的引用字符串
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
