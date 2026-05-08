"""
三阶段 Session 适配器

解决 LangChain 执行过程中的数据库连接管理问题：
- 阶段1：准备阶段 - 加载数据到内存，关闭连接
- 阶段2：执行阶段 - LangChain 执行，无 DB 连接
- 阶段3：保存阶段 - 保存结果，独立连接
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import AsyncSessionLocal
from db.models import Document, DocumentCoreInfo, DocumentSummary, Chapter, Paragraph

logger = logging.getLogger(__name__)


class DocumentContext:
    """文档上下文（预加载的数据）"""
    
    def __init__(
        self,
        document_id: UUID,
        document: Optional[Document] = None,
        core_info: Optional[List[DocumentCoreInfo]] = None,
        summaries: Optional[List[DocumentSummary]] = None,
        chapters: Optional[List[Chapter]] = None,
        paragraphs: Optional[Dict[UUID, List[Paragraph]]] = None,
    ):
        self.document_id = document_id
        self.document = document
        self.core_info = core_info or []
        self.summaries = summaries or []
        self.chapters = chapters or []
        self.paragraphs = paragraphs or {}  # {chapter_id: [paragraphs]}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于传递给 LangChain）"""
        return {
            "document_id": str(self.document_id),
            "document": {
                "title": self.document.title if self.document else "",
                "purpose": self.document.purpose if self.document else "",
            },
            "core_info": [
                {
                    "core_info_id": str(ci.core_info_id),
                    "title": ci.title,
                    "content": ci.content,
                    "field_key": ci.field_key,
                    "field_type": ci.field_type,
                    "parent_id": str(ci.parent_id) if ci.parent_id else None,
                }
                for ci in self.core_info
            ],
            "summaries": [
                {
                    "summary_id": str(s.summary_id),
                    "title": s.title,
                    "content": s.content,
                    "field_key": s.field_key,
                }
                for s in self.summaries
            ],
            "chapters": [
                {
                    "chapter_id": str(c.chapter_id),
                    "title": c.title,
                    "parent_id": str(c.parent_id) if c.parent_id else None,
                }
                for c in self.chapters
            ],
        }


class SessionAdapter:
    """三阶段 Session 适配器"""
    
    @staticmethod
    async def prepare_document_context(document_id: UUID) -> DocumentContext:
        """
        阶段1：准备文档上下文
        
        加载所有需要的数据到内存，然后关闭数据库连接
        
        Args:
            document_id: 文档 ID
        
        Returns:
            DocumentContext 实例
        """
        async with AsyncSessionLocal() as db:
            # 加载文档
            result = await db.execute(
                select(Document).where(Document.document_id == document_id)
            )
            document = result.scalar_one_or_none()
            
            if not document:
                raise ValueError(f"文档不存在: {document_id}")
            
            # 加载核心信息
            result = await db.execute(
                select(DocumentCoreInfo)
                .where(DocumentCoreInfo.document_id == document_id)
                .order_by(DocumentCoreInfo.order_index)
            )
            core_info = list(result.scalars().all())
            
            # 加载摘要
            result = await db.execute(
                select(DocumentSummary)
                .where(DocumentSummary.document_id == document_id)
                .order_by(DocumentSummary.order_index)
            )
            summaries = list(result.scalars().all())
            
            # 加载章节
            result = await db.execute(
                select(Chapter)
                .where(Chapter.document_id == document_id)
                .order_by(Chapter.order_index)
            )
            chapters = list(result.scalars().all())
            
            # 加载段落（按章节分组）
            paragraphs_by_chapter = {}
            for chapter in chapters:
                result = await db.execute(
                    select(Paragraph)
                    .where(Paragraph.chapter_id == chapter.chapter_id)
                    .order_by(Paragraph.order_index)
                )
                paragraphs_by_chapter[chapter.chapter_id] = list(result.scalars().all())
            
            logger.info(
                f"准备文档上下文: document_id={document_id} "
                f"core_info={len(core_info)} summaries={len(summaries)} "
                f"chapters={len(chapters)}"
            )
            
            return DocumentContext(
                document_id=document_id,
                document=document,
                core_info=core_info,
                summaries=summaries,
                chapters=chapters,
                paragraphs=paragraphs_by_chapter,
            )
    
    @staticmethod
    async def prepare_chapter_context(chapter_id: UUID) -> Dict[str, Any]:
        """
        阶段1：准备章节上下文
        
        Args:
            chapter_id: 章节 ID
        
        Returns:
            章节上下文字典
        """
        async with AsyncSessionLocal() as db:
            # 加载章节
            result = await db.execute(
                select(Chapter).where(Chapter.chapter_id == chapter_id)
            )
            chapter = result.scalar_one_or_none()
            
            if not chapter:
                raise ValueError(f"章节不存在: {chapter_id}")
            
            # 加载段落
            result = await db.execute(
                select(Paragraph)
                .where(Paragraph.chapter_id == chapter_id)
                .order_by(Paragraph.order_index)
            )
            paragraphs = list(result.scalars().all())
            
            # 加载文档上下文
            doc_context = await SessionAdapter.prepare_document_context(chapter.document_id)
            
            logger.info(
                f"准备章节上下文: chapter_id={chapter_id} "
                f"paragraphs={len(paragraphs)}"
            )
            
            return {
                "chapter": {
                    "chapter_id": str(chapter.chapter_id),
                    "title": chapter.title,
                    "document_id": str(chapter.document_id),
                },
                "paragraphs": [
                    {
                        "paragraph_id": str(p.paragraph_id),
                        "content": p.content,
                        "para_type": p.para_type,
                        "order_index": p.order_index,
                    }
                    for p in paragraphs
                ],
                "document_context": doc_context.to_dict(),
            }
    
    @staticmethod
    async def prepare_paragraph_context(paragraph_id: UUID) -> Dict[str, Any]:
        """
        阶段1：准备段落上下文
        
        Args:
            paragraph_id: 段落 ID
        
        Returns:
            段落上下文字典
        """
        async with AsyncSessionLocal() as db:
            # 加载段落
            result = await db.execute(
                select(Paragraph).where(Paragraph.paragraph_id == paragraph_id)
            )
            paragraph = result.scalar_one_or_none()
            
            if not paragraph:
                raise ValueError(f"段落不存在: {paragraph_id}")
            
            # 加载章节上下文
            chapter_context = await SessionAdapter.prepare_chapter_context(paragraph.chapter_id)
            
            logger.info(f"准备段落上下文: paragraph_id={paragraph_id}")
            
            return {
                "paragraph": {
                    "paragraph_id": str(paragraph.paragraph_id),
                    "content": paragraph.content,
                    "para_type": paragraph.para_type,
                    "chapter_id": str(paragraph.chapter_id),
                },
                "chapter_context": chapter_context,
            }
    
    @staticmethod
    @asynccontextmanager
    async def query_session():
        """
        阶段2：查询 Session（临时使用）
        
        用于 LangChain Tool 需要查询数据库的场景
        
        Usage:
            async with SessionAdapter.query_session() as db:
                result = await db.execute(...)
        """
        async with AsyncSessionLocal() as db:
            try:
                yield db
            finally:
                pass  # 自动关闭
    
    @staticmethod
    @asynccontextmanager
    async def save_session():
        """
        阶段3：保存 Session
        
        用于保存 LangChain 执行结果
        
        Usage:
            async with SessionAdapter.save_session() as db:
                db.add(...)
                await db.commit()
        """
        async with AsyncSessionLocal() as db:
            try:
                yield db
            except Exception:
                await db.rollback()
                raise


# 便捷函数

async def load_document_context(document_id: UUID) -> DocumentContext:
    """加载文档上下文"""
    return await SessionAdapter.prepare_document_context(document_id)


async def load_chapter_context(chapter_id: UUID) -> Dict[str, Any]:
    """加载章节上下文"""
    return await SessionAdapter.prepare_chapter_context(chapter_id)


async def load_paragraph_context(paragraph_id: UUID) -> Dict[str, Any]:
    """加载段落上下文"""
    return await SessionAdapter.prepare_paragraph_context(paragraph_id)
