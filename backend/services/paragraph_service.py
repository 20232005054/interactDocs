from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.chapter_mapper import ChapterMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Paragraph
from schemas.schemas import ParagraphCreate, ParagraphUpdate
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from db.models import Chapter, Document
from services.dependency_service import DependencyService

class ParagraphService:
    @staticmethod
    async def create_paragraph(db: AsyncSession, chapter_id: UUID, paragraph_in: ParagraphCreate):
        # 检查章节是否存在
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
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
        keyword_ids: list[UUID] | None = None,
    ):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")

        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)

        order_index = paragraph_in.order_index
        if order_index is None:
            if paragraphs:
                order_index = max(p.order_index for p in paragraphs) + 1
            else:
                order_index = 0
        else:
            for para in reversed(paragraphs):
                if para.order_index >= order_index:
                    await ParagraphMapper.update_paragraph(
                        db,
                        para.paragraph_id,
                        {"order_index": para.order_index + 1},
                    )

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

        if matched_summary_id:
            await DependencyService.create_dependency_edge(
                db,
                "paragraph",
                created_paragraph.paragraph_id,
                "summary",
                matched_summary_id,
                target_version=matched_summary_version,
                relevance_score=relevance_score,
            )

        for keyword_id in keyword_ids or []:
            await DependencyService.create_dependency_edge(
                db,
                "paragraph",
                created_paragraph.paragraph_id,
                "keyword",
                keyword_id,
            )

        return created_paragraph

    @staticmethod
    async def update_paragraph(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphUpdate):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
        # 检查内容是否发生实质性变更
        is_change = False
        from services.ai_service import is_substantial_change
        if paragraph_in.content is not None:
            is_change = await is_substantial_change(
                paragraph.content, paragraph_in.content
            )
        
        # 构建更新数据
        update_data = {}
        if paragraph_in.content is not None:
            update_data["content"] = paragraph_in.content
        if paragraph_in.para_type is not None:
            update_data["para_type"] = paragraph_in.para_type
        if paragraph_in.order_index is not None:
            update_data["order_index"] = paragraph_in.order_index
        if paragraph_in.ai_eval is not None:
            update_data["ai_eval"] = paragraph_in.ai_eval
        if paragraph_in.ai_suggestion is not None:
            update_data["ai_suggestion"] = paragraph_in.ai_suggestion
        
        # 如果发生实质性变更，更新ischange字段
        if is_change:
            update_data["ischange"] = 1
        
        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        
        # 处理段落变更时的摘要更新
        await ParagraphService._handle_paragraph_change(db, paragraph_id, is_change)
        
        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def delete_paragraph(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
        # 记录要删除的段落的order_index和章节ID
        deleted_order_index = paragraph.order_index
        chapter_id = paragraph.chapter_id
        
        # 删除段落
        await ParagraphMapper.delete_paragraph(db, paragraph)
        
        # 获取章节中剩余的所有段落
        remaining_paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        
        # 对剩余段落中order_index大于被删除段落的段落，将它们的order_index减1
        for para in remaining_paragraphs:
            if para.order_index > deleted_order_index:
                await ParagraphMapper.update_paragraph(db, para.paragraph_id, {"order_index": para.order_index - 1})
        
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
        """
        在指定段落后插入新段落
        """
        # 获取当前段落信息
        current_paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not current_paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
        # 获取当前段落的order_index和章节ID
        current_order_index = current_paragraph.order_index
        chapter_id = current_paragraph.chapter_id
        
        # 获取章节中所有段落
        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        
        # 将所有order_index大于等于当前段落order_index的段落的order_index加1
        for para in paragraphs:
            if para.order_index > current_order_index:
                await ParagraphMapper.update_paragraph(db, para.paragraph_id, {"order_index": para.order_index + 1})
        
        # 创建新段落，order_index设为当前段落order_index + 1
        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type="paragraph",  # 默认类型为正文
            order_index=current_order_index + 1,
            ai_eval=None,  # 默认为null
            ai_suggestion=None,  # 默认为null
            ai_generate=None,  # 默认为null
            ischange=0  # 默认为0
        )
        
        # 保存新段落
        return await ParagraphMapper.create_paragraph(db, new_paragraph)

    @staticmethod
    async def _handle_paragraph_change(db: AsyncSession, paragraph_id: UUID, is_substantial_change):
        """
        处理段落变更时的摘要更新
        当段落发生实质变更时，调用AI重新生成依赖该段落的摘要内容
        """
        if not is_substantial_change:
            return
        
        # 获取与该段落关联的摘要（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, "paragraph", paragraph_id, "summary"
        )
        
        # 获取段落信息及其所属章节和文档的元数据
        result = await db.execute(
            select(Paragraph, Chapter, Document)
            .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
            .join(Document, Chapter.document_id == Document.document_id)
            .where(Paragraph.paragraph_id == paragraph_id)
        )
        data = result.first()
        if not data:
            return
        
        target_paragraph, chapter, _ = data
        
        # 提取当前段落的所有层级标题
        hierarchy_titles = []
        para_result = await db.execute(
            select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
        )
        paragraphs = para_result.scalars().all()
        
        for para in paragraphs:
            if para.para_type in ['heading-1', 'heading-2', 'heading-3']:
                hierarchy_titles.append({
                    "type": para.para_type,
                    "content": para.content
                })
            if para.paragraph_id == paragraph_id:
                break
        
        # 构建下游段落信息
        downstream_paragraph = {
            "paragraph_id": str(target_paragraph.paragraph_id),
            "content": target_paragraph.content,
            "chapter_title": chapter.title,
            "hierarchy_titles": hierarchy_titles
        }
        
        for edge in edges:
            summary_id = edge.target_id
            
            try:
                # 调用AI帮填摘要，传入变更的段落信息作为下游依赖
                from services.ai_service import assist_single_summary
                
                await assist_single_summary(db, summary_id, downstream_paragraph)
                
                # 更新摘要的is_change字段为3，表示因下游段落变更而需要更新
                await SummaryMapper.update_summary(db, summary_id, {"is_change": 3})
                
            except Exception as e:
                print(f"处理段落变更时更新摘要失败: {e}")
                # 即使AI生成失败，也要标记摘要需要更新
                await SummaryMapper.update_summary(db, summary_id, {"is_change": 3})
    
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
            db, "paragraph", paragraph_id, "summary"
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
