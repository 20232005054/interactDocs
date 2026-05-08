"""
向量存储适配器

适配 LangChain VectorStore 接口，支持：
- PostgreSQL pgvector 后端
- 相似度搜索
- MMR 搜索
- 元数据过滤
"""

import logging
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import UUID

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from langchain_core.embeddings import Embeddings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from db.models import LiteratureChunk, Literature
from services.ai_client import get_embedding

logger = logging.getLogger(__name__)


class QwenEmbeddings(Embeddings):
    """通义千问 Embedding 适配器"""
    
    model: str = "text-embedding-v3"
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """同步嵌入（不推荐使用）"""
        raise NotImplementedError("请使用异步方法 aembed_documents")
    
    def embed_query(self, text: str) -> List[float]:
        """同步嵌入查询（不推荐使用）"""
        raise NotImplementedError("请使用异步方法 aembed_query")
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        异步嵌入文档列表
        
        Args:
            texts: 文本列表
        
        Returns:
            嵌入向量列表
        """
        embeddings = []
        for text in texts:
            embedding = await get_embedding(text)
            embeddings.append(embedding)
        return embeddings
    
    async def aembed_query(self, text: str) -> List[float]:
        """
        异步嵌入查询
        
        Args:
            text: 查询文本
        
        Returns:
            嵌入向量
        """
        return await get_embedding(text)


class LiteratureVectorStore(VectorStore):
    """
    文献向量存储
    
    适配 LangChain VectorStore 接口，后端使用 PostgreSQL pgvector
    """
    
    def __init__(
        self,
        db: AsyncSession,
        embeddings: Optional[Embeddings] = None,
    ):
        """
        初始化
        
        Args:
            db: 数据库会话
            embeddings: Embedding 模型
        """
        self.db = db
        self._embeddings = embeddings or QwenEmbeddings()
    
    @property
    def embeddings(self) -> Embeddings:
        """返回 Embedding 模型"""
        return self._embeddings
    
    def add_texts(
        self,
        texts: Iterable[str],
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> List[str]:
        """同步添加文本（不支持）"""
        raise NotImplementedError("请使用异步方法 aadd_texts")
    
    async def aadd_texts(
        self,
        texts: Iterable[str],
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> List[str]:
        """
        异步添加文本
        
        Args:
            texts: 文本列表
            metadatas: 元数据列表
            **kwargs: 额外参数
        
        Returns:
            文档 ID 列表
        """
        # 暂不实现，文献上传由现有流程处理
        raise NotImplementedError("文献上传请使用现有的 LiteratureService")
    
    def similarity_search(
        self,
        query: str,
        k: int = 4,
        **kwargs: Any,
    ) -> List[Document]:
        """同步相似度搜索（不支持）"""
        raise NotImplementedError("请使用异步方法 asimilarity_search")
    
    async def asimilarity_search(
        self,
        query: str,
        k: int = 4,
        **kwargs: Any,
    ) -> List[Document]:
        """
        异步相似度搜索
        
        Args:
            query: 查询文本
            k: 返回数量
            **kwargs: 额外参数（filter）
        
        Returns:
            文档列表
        """
        results = await self.asimilarity_search_with_score(query, k, **kwargs)
        return [doc for doc, _ in results]
    
    def similarity_search_with_score(
        self,
        query: str,
        k: int = 4,
        **kwargs: Any,
    ) -> List[Tuple[Document, float]]:
        """同步相似度搜索（带分数）（不支持）"""
        raise NotImplementedError("请使用异步方法 asimilarity_search_with_score")
    
    async def asimilarity_search_with_score(
        self,
        query: str,
        k: int = 4,
        **kwargs: Any,
    ) -> List[Tuple[Document, float]]:
        """
        异步相似度搜索（带分数）
        
        Args:
            query: 查询文本
            k: 返回数量
            **kwargs: 额外参数
                - filter: 元数据过滤 {"literature_ids": [...], "section_type": "..."}
        
        Returns:
            (文档, 相似度分数) 列表
        """
        # 获取查询向量
        query_embedding = await self._embeddings.aembed_query(query)
        
        # 构建查询
        filter_dict = kwargs.get("filter", {})
        literature_ids = filter_dict.get("literature_ids")
        section_type = filter_dict.get("section_type")
        
        # 使用 pgvector 的余弦相似度搜索
        # embedding 字段在数据库中是 vector 类型，需要用 <=> 操作符
        query_sql = """
            SELECT 
                lc.chunk_id,
                lc.literature_id,
                lc.section_type,
                lc.content,
                lc.chunk_index,
                l.title,
                l.authors,
                l.literature_key,
                1 - (lc.embedding::vector <=> :query_embedding::vector) as similarity
            FROM literature_chunks lc
            JOIN literature l ON lc.literature_id = l.literature_id
            WHERE l.upload_status = 'ready'
        """
        
        params = {"query_embedding": str(query_embedding)}
        
        # 添加过滤条件
        if literature_ids:
            query_sql += " AND lc.literature_id = ANY(:literature_ids)"
            params["literature_ids"] = literature_ids
        
        if section_type:
            query_sql += " AND lc.section_type = :section_type"
            params["section_type"] = section_type
        
        query_sql += " ORDER BY similarity DESC LIMIT :k"
        params["k"] = k
        
        # 执行查询
        result = await self.db.execute(text(query_sql), params)
        rows = result.fetchall()
        
        # 构建 Document 列表
        documents = []
        for row in rows:
            doc = Document(
                page_content=row.content,
                metadata={
                    "chunk_id": str(row.chunk_id),
                    "literature_id": str(row.literature_id),
                    "literature_key": row.literature_key,
                    "section_type": row.section_type,
                    "chunk_index": row.chunk_index,
                    "title": row.title,
                    "authors": row.authors,
                }
            )
            documents.append((doc, float(row.similarity)))
        
        logger.info(f"向量检索: query={query[:50]}... k={k} results={len(documents)}")
        return documents
    
    async def asimilarity_search_by_vector(
        self,
        embedding: List[float],
        k: int = 4,
        **kwargs: Any,
    ) -> List[Document]:
        """
        通过向量进行相似度搜索
        
        Args:
            embedding: 查询向量
            k: 返回数量
            **kwargs: 额外参数
        
        Returns:
            文档列表
        """
        filter_dict = kwargs.get("filter", {})
        literature_ids = filter_dict.get("literature_ids")
        section_type = filter_dict.get("section_type")
        
        query_sql = """
            SELECT 
                lc.chunk_id,
                lc.literature_id,
                lc.section_type,
                lc.content,
                lc.chunk_index,
                l.title,
                l.authors,
                l.literature_key,
                1 - (lc.embedding::vector <=> :query_embedding::vector) as similarity
            FROM literature_chunks lc
            JOIN literature l ON lc.literature_id = l.literature_id
            WHERE l.upload_status = 'ready'
        """
        
        params = {"query_embedding": str(embedding)}
        
        if literature_ids:
            query_sql += " AND lc.literature_id = ANY(:literature_ids)"
            params["literature_ids"] = literature_ids
        
        if section_type:
            query_sql += " AND lc.section_type = :section_type"
            params["section_type"] = section_type
        
        query_sql += " ORDER BY similarity DESC LIMIT :k"
        params["k"] = k
        
        result = await self.db.execute(text(query_sql), params)
        rows = result.fetchall()
        
        documents = []
        for row in rows:
            doc = Document(
                page_content=row.content,
                metadata={
                    "chunk_id": str(row.chunk_id),
                    "literature_id": str(row.literature_id),
                    "literature_key": row.literature_key,
                    "section_type": row.section_type,
                    "chunk_index": row.chunk_index,
                    "title": row.title,
                    "authors": row.authors,
                }
            )
            documents.append(doc)
        
        return documents
    
    @classmethod
    def from_texts(
        cls,
        texts: List[str],
        embedding: Embeddings,
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> "LiteratureVectorStore":
        """从文本创建（不支持）"""
        raise NotImplementedError("请使用现有的 LiteratureService 上传文献")
    
    @classmethod
    async def afrom_texts(
        cls,
        texts: List[str],
        embedding: Embeddings,
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any,
    ) -> "LiteratureVectorStore":
        """异步从文本创建（不支持）"""
        raise NotImplementedError("请使用现有的 LiteratureService 上传文献")


def create_vector_store(db: AsyncSession) -> LiteratureVectorStore:
    """
    创建向量存储实例
    
    Args:
        db: 数据库会话
    
    Returns:
        LiteratureVectorStore 实例
    """
    return LiteratureVectorStore(db=db, embeddings=QwenEmbeddings())
