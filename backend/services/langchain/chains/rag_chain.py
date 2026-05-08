"""
RAG 检索链

实现文献检索和上下文格式化：
- 混合检索（向量 + 关键词）
- 重排序
- 上下文格式化
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from langchain_core.documents import Document
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from services.langchain.core.vector_stores import LiteratureVectorStore
from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.session_adapter import SessionAdapter
from db.mappers.template_literature_mapper import TemplateLiteratureMapper
from db.mappers.paragraph_literature_mapper import ParagraphLiteratureMapper

logger = logging.getLogger(__name__)


class LiteratureRAGChain:
    """
    文献 RAG 检索链
    
    实现两级检索策略：
    1. 段落级检索：先检索段落绑定的文献，不足时补充模板级文献
    2. 模板级检索：只检索模板绑定的文献
    """
    
    def __init__(
        self,
        vector_store: LiteratureVectorStore,
        top_k: int = 5,
    ):
        """
        初始化
        
        Args:
            vector_store: 向量存储
            top_k: 返回文献数量
        """
        self.vector_store = vector_store
        self.top_k = top_k
        self.llm = get_qwen_llm()
    
    async def retrieve_for_paragraph(
        self,
        query: str,
        paragraph_id: UUID,
        template_id: UUID,
        user_id: UUID,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        段落级检索（两级策略）
        
        Args:
            query: 查询文本
            paragraph_id: 段落 ID
            template_id: 模板 ID
            user_id: 用户 ID
        
        Returns:
            (formatted_context, citations)
        """
        async with SessionAdapter.query_session() as db:
            # 第一级：段落绑定的文献
            paragraph_lit_ids = await ParagraphLiteratureMapper.get_literature_ids(
                db, paragraph_id
            )
            
            documents = []
            
            if paragraph_lit_ids:
                # 检索段落级文献
                docs = await self.vector_store.asimilarity_search_with_score(
                    query=query,
                    k=self.top_k,
                    filter={"literature_ids": paragraph_lit_ids}
                )
                documents.extend(docs)
                logger.info(f"段落级检索: paragraph_id={paragraph_id} results={len(docs)}")
            
            # 第二级：如果不足 top_k，补充模板级文献
            if len(documents) < self.top_k:
                template_lit_ids = await TemplateLiteratureMapper.get_literature_ids(
                    db, template_id, user_id
                )
                
                if template_lit_ids:
                    # 排除已检索的文献
                    remaining_lit_ids = [
                        lit_id for lit_id in template_lit_ids
                        if lit_id not in paragraph_lit_ids
                    ]
                    
                    if remaining_lit_ids:
                        remaining_k = self.top_k - len(documents)
                        docs = await self.vector_store.asimilarity_search_with_score(
                            query=query,
                            k=remaining_k,
                            filter={"literature_ids": remaining_lit_ids}
                        )
                        documents.extend(docs)
                        logger.info(f"模板级补充: template_id={template_id} results={len(docs)}")
        
        # 格式化上下文
        formatted_context, citations = self._format_context(documents)
        return formatted_context, citations
    
    async def retrieve_for_template(
        self,
        query: str,
        template_id: UUID,
        user_id: UUID,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        模板级检索
        
        Args:
            query: 查询文本
            template_id: 模板 ID
            user_id: 用户 ID
        
        Returns:
            (formatted_context, citations)
        """
        async with SessionAdapter.query_session() as db:
            # 获取模板绑定的文献
            literature_ids = await TemplateLiteratureMapper.get_literature_ids(
                db, template_id, user_id
            )
            
            if not literature_ids:
                logger.info(f"模板无绑定文献: template_id={template_id}")
                return "", []
            
            # 向量检索
            documents = await self.vector_store.asimilarity_search_with_score(
                query=query,
                k=self.top_k,
                filter={"literature_ids": literature_ids}
            )
            
            logger.info(f"模板级检索: template_id={template_id} results={len(documents)}")
        
        # 格式化上下文
        formatted_context, citations = self._format_context(documents)
        return formatted_context, citations
    
    def _format_context(
        self,
        documents: List[Tuple[Document, float]]
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        格式化检索结果为上下文
        
        Args:
            documents: (文档, 相似度分数) 列表
        
        Returns:
            (formatted_context, citations)
        """
        if not documents:
            return "", []
        
        # 按相似度排序（已排序，但确保）
        documents = sorted(documents, key=lambda x: x[1], reverse=True)
        
        # 构建引用列表
        citations = []
        context_parts = ["【参考文献】"]
        
        for idx, (doc, score) in enumerate(documents, start=1):
            metadata = doc.metadata
            
            # 构建引用信息
            citation = {
                "index": idx,
                "literature_id": metadata.get("literature_id"),
                "literature_key": metadata.get("literature_key"),
                "title": metadata.get("title"),
                "authors": metadata.get("authors"),
                "section_type": metadata.get("section_type"),
                "similarity": float(score),
            }
            citations.append(citation)
            
            # 格式化上下文
            title = metadata.get("title", "未知标题")
            authors = metadata.get("authors", "未知作者")
            section = metadata.get("section_type", "")
            content = doc.page_content
            
            context_parts.append(
                f"\n[{idx}] {title}\n"
                f"作者: {authors}\n"
                f"章节: {section}\n"
                f"内容: {content}\n"
            )
        
        formatted_context = "\n".join(context_parts)
        return formatted_context, citations
    
    async def rerank_documents(
        self,
        query: str,
        documents: List[Tuple[Document, float]],
        top_k: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        """
        使用 LLM 重排序文档
        
        Args:
            query: 查询文本
            documents: 文档列表
            top_k: 返回数量
        
        Returns:
            重排序后的文档列表
        """
        if not documents:
            return []
        
        top_k = top_k or self.top_k
        
        # 构建重排序 prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", "你是一个文献相关性评估专家。"),
            ("human", """请评估以下文献片段与查询的相关性，给出 0-1 的分数。

查询：{query}

文献片段：
{documents}

请为每个文献片段给出相关性分数（0-1），格式：
1: 0.95
2: 0.87
...
""")
        ])
        
        # 格式化文档
        doc_texts = []
        for idx, (doc, _) in enumerate(documents, start=1):
            doc_texts.append(f"{idx}. {doc.page_content[:200]}...")
        
        # 调用 LLM
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "query": query,
            "documents": "\n\n".join(doc_texts)
        })
        
        # 解析分数
        scores = self._parse_rerank_scores(result, len(documents))
        
        # 重新排序
        reranked = [
            (doc, score)
            for (doc, _), score in zip(documents, scores)
        ]
        reranked.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"重排序: 原始={len(documents)} 返回={min(top_k, len(reranked))}")
        return reranked[:top_k]
    
    def _parse_rerank_scores(self, result: str, count: int) -> List[float]:
        """
        解析重排序分数
        
        Args:
            result: LLM 输出
            count: 文档数量
        
        Returns:
            分数列表
        """
        scores = [0.5] * count  # 默认分数
        
        try:
            lines = result.strip().split("\n")
            for line in lines:
                if ":" in line:
                    parts = line.split(":")
                    idx = int(parts[0].strip()) - 1
                    score = float(parts[1].strip())
                    if 0 <= idx < count:
                        scores[idx] = score
        except Exception as e:
            logger.warning(f"解析重排序分数失败: {e}")
        
        return scores


def create_rag_chain(
    vector_store: LiteratureVectorStore,
    top_k: int = 5,
) -> LiteratureRAGChain:
    """
    创建 RAG 检索链
    
    Args:
        vector_store: 向量存储
        top_k: 返回文献数量
    
    Returns:
        LiteratureRAGChain 实例
    """
    return LiteratureRAGChain(vector_store=vector_store, top_k=top_k)
