from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Paragraph
from schemas.schemas import ParagraphCreate, ParagraphUpdate
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from db.models import Chapter, Document, Paragraph
from services.dependency_service import DependencyService
from typing import Optional
from core.constants import EdgeSourceType, EdgeTargetType

class ParagraphService:
    @staticmethod
    async def create_paragraph(db: AsyncSession, chapter_id: UUID, paragraph_in: ParagraphCreate):

        
        # 获取章节的所有段落，确定最大order_index
        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        if paragraphs:
            max_order_index = max(p.order_index for p in paragraphs)
            order_index = max_order_index + 1
        else:
            order_index = 0  # 章节无段落时从0开始
        
        # 创建新段落
        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type="paragraph",  # 默认类型为正文
            order_index=order_index,
            ai_eval=None,  # 默认为null
            ai_suggestion=None,  # 默认为null
            ai_generate=None,  # 默认为null
            ischange=0  # 默认为0
        )
        
        return await ParagraphMapper.create_paragraph(db, new_paragraph)

    @staticmethod
    async def create_complete_paragraph(
        db: AsyncSession,
        chapter_id: UUID,
        paragraph_in: ParagraphCreate,
        matched_summary_id: UUID = None,
        matched_summary_version: int = None,
        relevance_score: float = 1.0,
        keyword_ids: Optional[list[UUID]] = None,
    ):

        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)

        order_index = paragraph_in.order_index
        if order_index is None:
            if paragraphs:
                order_index = max(p.order_index for p in paragraphs) + 1
            else:
                order_index = 0
        else:
            await ParagraphMapper.shift_order_index(db, chapter_id, order_index, delta=1)

        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type=paragraph_in.para_type or "paragraph",
            order_index=order_index,
            ai_eval=paragraph_in.ai_eval,
            ai_suggestion=paragraph_in.ai_suggestion,
            ai_generate=paragraph_in.ai_generate,
            ischange=paragraph_in.ischange if paragraph_in.ischange is not None else 0,
        )

        created_paragraph = await ParagraphMapper.create_paragraph(db, new_paragraph)

        # 获取 document_id 用于依赖边
        chapter = await db.get(Chapter, chapter_id)
        doc_id = chapter.document_id if chapter else None

        if matched_summary_id and doc_id:
            await DependencyService.create_dependency_edge(
                db,
                EdgeSourceType.CHAPTER,
                chapter_id,
                EdgeTargetType.SUMMARY,
                matched_summary_id,
                document_id=doc_id,
                target_version=matched_summary_version,
                relevance_score=relevance_score,
            )

        for keyword_id in keyword_ids or []:
            if doc_id:
                await DependencyService.create_dependency_edge(
                    db,
                    EdgeSourceType.CHAPTER,
                    chapter_id,
                    EdgeTargetType.KEYWORD,
                    keyword_id,
                    document_id=doc_id,
                )

        return created_paragraph

    @staticmethod
    async def update_paragraph(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphUpdate):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        update_data = {}
        if paragraph_in.content is not None:
            update_data["content"] = paragraph_in.content
            # 内容有变化时标记 ischange=1（已被手动修改，与原始生成版本不同）
            if paragraph_in.content != paragraph.content:
                update_data["ischange"] = 1
        if paragraph_in.para_type is not None:
            update_data["para_type"] = paragraph_in.para_type
        if paragraph_in.ai_eval is not None:
            update_data["ai_eval"] = paragraph_in.ai_eval
        if paragraph_in.ai_suggestion is not None:
            update_data["ai_suggestion"] = paragraph_in.ai_suggestion

        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def delete_paragraph(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        deleted_order_index = paragraph.order_index
        chapter_id = paragraph.chapter_id

        await ParagraphMapper.delete_paragraph(db, paragraph)
        await ParagraphMapper.shift_order_index(db, chapter_id, deleted_order_index + 1, delta=-1)
        await db.commit()

        return {"message": "删除成功"}

    @staticmethod
    async def get_paragraph_detail(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        return paragraph

    @staticmethod
    async def get_paragraphs_by_chapter_id(db: AsyncSession, chapter_id: UUID):
        return await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)

    @staticmethod
    async def insert_paragraph_after(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphCreate):
        """在指定段落后插入新段落"""
        current_paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not current_paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        current_order_index = current_paragraph.order_index
        chapter_id = current_paragraph.chapter_id
        insert_index = current_order_index + 1

        await ParagraphMapper.shift_order_index(db, chapter_id, insert_index, delta=1)

        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type="paragraph",
            order_index=insert_index,
            ai_eval=None,
            ai_suggestion=None,
            ai_generate=None,
            ischange=0
        )
        result = await ParagraphMapper.create_paragraph(db, new_paragraph)
        await db.commit()
        return result

    
    @staticmethod
    async def apply_ai_assist_result(db: AsyncSession, paragraph_id: UUID):
        """
        应用AI帮填结果，将ai_generate字段的内容填充到content字段
        """
        # 获取段落信息
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
        if not paragraph.ai_generate:
            raise HTTPException(status_code=400, detail="AI帮填结果不存在")
        
        # 构建更新数据：将ai_generate内容填充到content，ischange置0
        update_data = {
            "content": paragraph.ai_generate,
            "ischange": 0  # 重置为无变更状态
        }
        
        # 更新段落
        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        
        # 返回更新后的段落
        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
    
    @staticmethod
    async def get_paragraph_related_summaries(db: AsyncSession, paragraph_id: UUID):
        """
        获取段落关联的摘要信息
        """
        # 获取段落的所有关联链接（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, EdgeSourceType.PARAGRAPH, paragraph_id, EdgeTargetType.SUMMARY
        )
        
        related_summaries = []
        for edge in edges:
            # 获取摘要详情
            summary = await SummaryMapper.get_summary_by_id(db, edge.target_id)
            if summary:
                # 直接使用纯文本内容
                related_summaries.append({
                    "summary_id": summary.summary_id,
                    "document_id": summary.document_id,
                    "title": summary.title,
                    "content": summary.content,
                    "version": summary.version,
                    "created_at": summary.created_at,
                    "updated_at": summary.updated_at,
                    "relevance_score": edge.relevance_score
                })
        
        return related_summaries
