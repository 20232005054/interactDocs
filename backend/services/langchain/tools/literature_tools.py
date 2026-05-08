"""
文献检索工具

提供文献搜索和引用验证功能
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from services.langchain.core.session_adapter import SessionAdapter
from services.langchain.core.vector_stores import create_vector_store
from services.langchain.chains.rag_chain import create_rag_chain

logger = logging.getLogger(__name__)


# ============================================================
# 查询工具（临时 Session）
# ============================================================

class SearchLiteratureInput(BaseModel):
    """搜索文献输入"""
    query: str = Field(description="搜索查询")
    template_id: str = Field(description="模板 ID")
    user_id: str = Field(description="用户 ID")
    top_k: int = Field(default=5, description="返回数量")


class SearchLiteratureTool(BaseTool):
    """搜索文献工具"""
    
    name: str = "search_literature"
    description: str = """
    搜索相关文献。
    
    输入：查询文本、模板 ID、用户 ID、返回数量
    输出：格式化的文献列表（含引用编号）
    
    示例：
    输入：{"query": "临床试验设计", "template_id": "xxx", "user_id": "yyy", "top_k": 3}
    输出：
    [1] 文献标题1
    作者: XXX
    内容: ...
    
    [2] 文献标题2
    作者: YYY
    内容: ...
    """
    args_schema: type[BaseModel] = SearchLiteratureInput
    
    def _run(
        self,
        query: str,
        template_id: str,
        user_id: str,
        top_k: int = 5,
    ) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(
        self,
        query: str,
        template_id: str,
        user_id: str,
        top_k: int = 5,
    ) -> str:
        """
        异步运行
        
        Args:
            query: 搜索查询
            template_id: 模板 ID
            user_id: 用户 ID
            top_k: 返回数量
        
        Returns:
            格式化的文献列表
        """
        try:
            async with SessionAdapter.query_session() as db:
                # 创建向量存储和 RAG 链
                vector_store = create_vector_store(db)
                rag_chain = create_rag_chain(vector_store, top_k=top_k)
                
                # 检索文献
                formatted_context, citations = await rag_chain.retrieve_for_template(
                    query=query,
                    template_id=UUID(template_id),
                    user_id=UUID(user_id),
                )
                
                if not formatted_context:
                    return "（未找到相关文献）"
                
                logger.info(
                    f"搜索文献: query={query[:50]}... "
                    f"template_id={template_id} results={len(citations)}"
                )
                
                return formatted_context
        
        except Exception as e:
            logger.error(f"搜索文献失败: {e}")
            return f"（搜索失败：{str(e)}）"


class ValidateEntityInput(BaseModel):
    """验证实体输入"""
    entity_type: str = Field(description="实体类型（chapter/paragraph/summary）")
    entity_id: str = Field(description="实体 ID")


class ValidateEntityTool(BaseTool):
    """验证实体存在性工具"""
    
    name: str = "validate_entity"
    description: str = """
    验证实体（章节/段落/摘要）是否存在。
    
    输入：实体类型、实体 ID
    输出：验证结果（存在/不存在）
    
    示例：
    输入：{"entity_type": "chapter", "entity_id": "xxx"}
    输出：章节存在：研究背景
    """
    args_schema: type[BaseModel] = ValidateEntityInput
    
    def _run(self, entity_type: str, entity_id: str) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(self, entity_type: str, entity_id: str) -> str:
        """
        异步运行
        
        Args:
            entity_type: 实体类型
            entity_id: 实体 ID
        
        Returns:
            验证结果
        """
        try:
            async with SessionAdapter.query_session() as db:
                from sqlalchemy import select
                
                # 根据类型查询
                if entity_type == "chapter":
                    from db.models import Chapter
                    result = await db.execute(
                        select(Chapter).where(Chapter.chapter_id == UUID(entity_id))
                    )
                    entity = result.scalar_one_or_none()
                    if entity:
                        return f"章节存在：{entity.title}"
                    else:
                        return f"章节不存在：{entity_id}"
                
                elif entity_type == "paragraph":
                    from db.models import Paragraph
                    result = await db.execute(
                        select(Paragraph).where(Paragraph.paragraph_id == UUID(entity_id))
                    )
                    entity = result.scalar_one_or_none()
                    if entity:
                        return f"段落存在（类型：{entity.para_type}）"
                    else:
                        return f"段落不存在：{entity_id}"
                
                elif entity_type == "summary":
                    from db.models import DocumentSummary
                    result = await db.execute(
                        select(DocumentSummary).where(DocumentSummary.summary_id == UUID(entity_id))
                    )
                    entity = result.scalar_one_or_none()
                    if entity:
                        return f"摘要存在：{entity.title}"
                    else:
                        return f"摘要不存在：{entity_id}"
                
                else:
                    return f"不支持的实体类型：{entity_type}"
        
        except Exception as e:
            logger.error(f"验证实体失败: {e}")
            return f"（验证失败：{str(e)}）"


class GetDependencyGraphInput(BaseModel):
    """获取依赖图谱输入"""
    document_id: str = Field(description="文档 ID")


class GetDependencyGraphTool(BaseTool):
    """获取依赖图谱工具"""
    
    name: str = "get_dependency_graph"
    description: str = """
    获取文档的依赖关系图谱。
    
    输入：文档 ID
    输出：依赖关系列表
    
    示例：
    输入：{"document_id": "xxx"}
    输出：
    段落1 → 摘要1
    段落2 → 摘要2
    摘要1 → 核心信息1
    """
    args_schema: type[BaseModel] = GetDependencyGraphInput
    
    def _run(self, document_id: str) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(self, document_id: str) -> str:
        """
        异步运行
        
        Args:
            document_id: 文档 ID
        
        Returns:
            依赖关系列表
        """
        try:
            async with SessionAdapter.query_session() as db:
                from sqlalchemy import select
                from db.models import DependencyEdge
                
                # 查询依赖边
                result = await db.execute(
                    select(DependencyEdge)
                    .where(DependencyEdge.document_id == UUID(document_id))
                )
                edges = result.scalars().all()
                
                if not edges:
                    return "（无依赖关系）"
                
                # 格式化输出
                lines = []
                for edge in edges:
                    source = f"{edge.source_type}({str(edge.source_id)[:8]}...)"
                    target = f"{edge.target_type}({str(edge.target_id)[:8]}...)"
                    lines.append(f"{source} → {target}")
                
                result = "\n".join(lines)
                logger.info(f"获取依赖图谱: document_id={document_id} edges={len(edges)}")
                return result
        
        except Exception as e:
            logger.error(f"获取依赖图谱失败: {e}")
            return f"（获取失败：{str(e)}）"


# ============================================================
# 工具创建函数
# ============================================================

def create_query_tools() -> List[BaseTool]:
    """
    创建查询工具列表
    
    Returns:
        工具列表
    """
    return [
        SearchLiteratureTool(),
        ValidateEntityTool(),
        GetDependencyGraphTool(),
    ]
