from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.chapter_mapper import ChapterMapper
from db.models import Paragraph
from schemas.schemas import ParagraphCreate, ParagraphUpdate
from uuid import UUID
from fastapi import HTTPException

class ParagraphService:
    @staticmethod
    async def create_paragraph(db: AsyncSession, chapter_id: UUID, paragraph_in: ParagraphCreate):
        # 检查章节是否存在
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 创建新段落
        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type=paragraph_in.para_type,
            order_index=paragraph_in.order_index,
            ai_eval=paragraph_in.ai_eval,
            ai_suggestion=paragraph_in.ai_suggestion,
            ai_generate=paragraph_in.ai_generate,
            ischange=paragraph_in.ischange
        )
        
        return await ParagraphMapper.create_paragraph(db, new_paragraph)

    @staticmethod
    async def update_paragraph(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphUpdate):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
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
        
        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def delete_paragraph(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        
        await ParagraphMapper.delete_paragraph(db, paragraph)
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
