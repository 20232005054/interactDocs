"""
AI 上下文构建服务

职责：
1. 统一构建文档上下文（核心信息、摘要、章节）
2. 统一文献 RAG 注入逻辑
3. 提供可复用的上下文构建方法
"""

import logging
from typing import Optional, List, Dict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Document, DocumentCoreInfo, DocumentSummary, Chapter, Paragraph

logger = logging.getLogger(__name__)


class AIContextBuilder:
    """AI 上下文构建器"""
    
    @staticmethod
    async def get_core_info_structured_text(
        db: AsyncSession,
        document_id: UUID,
    ) -> str:
        """
        获取文档核心信息的结构化文本（树形展示）
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
            
        Returns:
            结构化的核心信息文本，格式：
            试验名称：XXX
            试验目的：
              主要目的：XXX
              次要目的：XXX
        """
        result = await db.execute(
            select(DocumentCoreInfo)
            .where(DocumentCoreInfo.document_id == document_id)
            .order_by(DocumentCoreInfo.order_index)
        )
        all_nodes = result.scalars().all()
        
        if not all_nodes:
            return ""
        
        def build_text(parent_id: Optional[UUID], indent: int) -> str:
            """递归构建树形文本"""
            lines = []
            children = [n for n in all_nodes if n.parent_id == parent_id]
            children.sort(key=lambda x: x.order_index)
            
            prefix = "  " * indent
            for node in children:
                if node.field_type == "group":
                    # 分组节点：只显示标题，递归子节点
                    lines.append(f"{prefix}{node.title}：")
                    lines.append(build_text(node.core_info_id, indent + 1))
                else:
                    # 叶子节点：显示标题和内容
                    if node.content and node.content.strip():
                        lines.append(f"{prefix}{node.title}：{node.content.strip()}")
            
            return "\n".join(filter(None, lines))
        
        return build_text(None, 0)
    
    @staticmethod
    async def get_summaries_text(
        db: AsyncSession,
        document_id: UUID,
    ) -> str:
        """
        获取文档摘要列表的文本
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
            
        Returns:
            摘要文本，格式：
            【文档摘要】
              研究背景：XXX
              研究目的：XXX
        """
        result = await db.execute(
            select(DocumentSummary)
            .where(DocumentSummary.document_id == document_id)
            .order_by(DocumentSummary.order_index)
        )
        summaries = result.scalars().all()
        
        if not summaries:
            return ""
        
        summary_lines = [
            f"  {s.title}：{s.content}"
            for s in summaries
            if s.content and s.content.strip()
        ]
        
        if not summary_lines:
            return ""
        
        return "【文档摘要】\n" + "\n".join(summary_lines)
    
    @staticmethod
    async def get_chapter_content(
        db: AsyncSession,
        chapter_id: UUID,
    ) -> tuple[Optional[Chapter], str]:
        """
        获取章节的完整内容（所有段落拼接）
        
        Args:
            db: 数据库会话
            chapter_id: 章节 ID
            
        Returns:
            (chapter, content_text)
        """
        result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        
        if not chapter:
            return None, ""
        
        para_result = await db.execute(
            select(Paragraph)
            .where(Paragraph.chapter_id == chapter_id)
            .order_by(Paragraph.order_index)
        )
        paragraphs = para_result.scalars().all()
        
        content = "\n".join(p.content for p in paragraphs if p.content)
        return chapter, content
    
    @staticmethod
    async def build_document_context(
        db: AsyncSession,
        document_id: UUID,
        include_core_info: bool = True,
        include_summaries: bool = True,
        current_chapter_id: Optional[UUID] = None,
    ) -> str:
        """
        构建完整的文档上下文（用于 AI prompt）
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
            include_core_info: 是否包含核心信息
            include_summaries: 是否包含摘要
            current_chapter_id: 当前章节 ID（可选）
            
        Returns:
            完整的上下文文本
        """
        parts = []
        
        # 文档基本信息
        result = await db.execute(
            select(Document).where(Document.document_id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document:
            parts.append(f"当前文档：{document.title}")
            if document.purpose:
                parts.append(f"文档用途：{document.purpose}")
        
        # 核心信息背景
        if include_core_info:
            try:
                core_info_text = await AIContextBuilder.get_core_info_structured_text(
                    db, document_id
                )
                if core_info_text:
                    parts.append(f"【文档核心信息背景】\n{core_info_text}")
            except Exception as e:
                logger.warning("获取核心信息失败: %s", e)
        
        # 文档摘要
        if include_summaries:
            try:
                summaries_text = await AIContextBuilder.get_summaries_text(db, document_id)
                if summaries_text:
                    parts.append(summaries_text)
            except Exception as e:
                logger.warning("获取摘要失败: %s", e)
        
        # 当前章节
        if current_chapter_id:
            try:
                chapter, chapter_content = await AIContextBuilder.get_chapter_content(
                    db, current_chapter_id
                )
                if chapter:
                    parts.append(f"【当前章节】\n章节标题：{chapter.title}")
                    if chapter_content:
                        parts.append(f"章节内容：\n{chapter_content}")
            except Exception as e:
                logger.warning("获取章节内容失败: %s", e)
        
        return "\n\n".join(parts)
    
    @staticmethod
    async def inject_literature_context(
        db: AsyncSession,
        document: Document,
        query: str,
        paragraph_id: Optional[UUID] = None,
        top_k: int = 5,
    ) -> tuple[str, List[Dict]]:
        """
        注入文献 RAG 上下文（统一入口）
        
        Args:
            db: 数据库会话
            document: 文档对象
            query: 检索查询（通常是 title + prompt）
            paragraph_id: 段落 ID（可选，用于段落级检索）
            top_k: 返回文献数量
            
        Returns:
            (literature_context, citations)
            - literature_context: 格式化的文献上下文字符串
            - citations: 引用列表
        """
        if not document.template_id or not document.user_id:
            logger.info("文档缺少 template_id 或 user_id，跳过文献检索")
            return "", []
        
        try:
            from services.literature_rag_service import LiteratureRagService
            
            # 段落级检索（两级策略）
            if paragraph_id:
                literature_context, citations = await LiteratureRagService.retrieve_and_format_for_paragraph(
                    db=db,
                    paragraph_id=paragraph_id,
                    document_template_id=document.template_id,
                    user_id=document.user_id,
                    query=query[:500],  # 限制查询长度
                    top_k=top_k,
                )
            # 模板级检索
            else:
                literature_context, citations = await LiteratureRagService.retrieve_and_format(
                    db=db,
                    document_template_id=document.template_id,
                    user_id=document.user_id,
                    query=query[:500],
                    top_k=top_k,
                )
            
            if literature_context:
                logger.info(
                    "[RAG] 文献检索成功 document_id=%s paragraph_id=%s citations=%d",
                    document.document_id,
                    paragraph_id or "N/A",
                    len(citations)
                )
            else:
                logger.info(
                    "[RAG] 未检索到相关文献 document_id=%s paragraph_id=%s",
                    document.document_id,
                    paragraph_id or "N/A"
                )
            
            return literature_context, citations
            
        except Exception as e:
            logger.warning(
                "文献 RAG 注入失败，跳过: %s",
                e,
                exc_info=True
            )
            return "", []
    
    @staticmethod
    async def save_literature_citations(
        db: AsyncSession,
        document_id: UUID,
        source_type: str,
        source_id: UUID,
        ai_content: str,
        citations: List[Dict],
    ) -> None:
        """
        保存文献引用记录（统一入口）
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
            source_type: 来源类型（"paragraph" 或 "summary"）
            source_id: 来源 ID
            ai_content: AI 生成的内容
            citations: 引用列表
        """
        if not citations or not ai_content:
            return
        
        try:
            from services.literature_rag_service import LiteratureRagService
            
            await LiteratureRagService.save_citations(
                db=db,
                document_id=document_id,
                source_type=source_type,
                source_id=source_id,
                ai_content=ai_content,
                citations=citations,
            )
            
            logger.info(
                "文献引用记录保存成功 source_type=%s source_id=%s citations=%d",
                source_type,
                source_id,
                len(citations)
            )
            
        except Exception as e:
            logger.warning(
                "保存文献引用记录失败: %s",
                e,
                exc_info=True
            )
