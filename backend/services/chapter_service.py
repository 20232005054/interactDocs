from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.chapter_mapper import ChapterMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from db.models import Chapter
from schemas.schemas import ChapterUpdate
from uuid import UUID
from fastapi import HTTPException

class ChapterService:
    @staticmethod
    async def get_chapters_by_document_id(db: AsyncSession, document_id: UUID):
        chapters = await ChapterMapper.get_chapters_by_document_id(db, document_id)
        # 构建章节的字典列表
        chapter_list = []
        for chapter in chapters:
            chapter_dict = {
                "chapter_id": chapter.chapter_id,
                "document_id": chapter.document_id,
                "title": chapter.title,
                "status": chapter.status,
                "order_index": chapter.order_index,
                "updated_at": chapter.updated_at
            }
            chapter_list.append(chapter_dict)
        return chapter_list

    @staticmethod
    async def get_chapter_detail(db: AsyncSession, chapter_id: UUID):
        # 直接使用mapper获取章节和段落
        chapter, paragraphs = await ChapterMapper.get_chapter_with_paragraphs(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 构建包含段落的字典，将段落对象转换为可序列化的字典
        paragraphs_dict = []
        for para in paragraphs:
            para_dict = {
                "paragraph_id": para.paragraph_id,
                "chapter_id": para.chapter_id,
                "content": para.content,
                "para_type": para.para_type,
                "order_index": para.order_index,
                "ai_eval": para.ai_eval,
                "ai_suggestion": para.ai_suggestion,
                "ai_generate": para.ai_generate,
                "ischange": para.ischange
            }
            paragraphs_dict.append(para_dict)
        
        # 构建章节字典
        chapter_dict = {
            "chapter_id": chapter.chapter_id,
            "document_id": chapter.document_id,
            "title": chapter.title,
            "status": chapter.status,
            "order_index": chapter.order_index,
            "updated_at": chapter.updated_at,
            "paragraphs": paragraphs_dict
        }
        return chapter_dict

    @staticmethod
    async def create_chapter(db: AsyncSession, document_id: UUID):
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 计算默认的 order_index：当前文档最大 order_index + 1
        chapters = await ChapterMapper.get_chapters_by_document_id(db, document_id)
        max_order_index = max([chapter.order_index for chapter in chapters], default=-1)
        order_index = max_order_index + 1
        
        # 创建新章节，使用默认值
        new_chapter = Chapter(
            document_id=document_id,
            title=f"新章节",  # 默认标题
            status=0,  # 默认状态：0-编辑中
            order_index=order_index
        )
        
        return await ChapterMapper.create_chapter(db, new_chapter)

    @staticmethod
    async def update_chapter(db: AsyncSession, chapter_id: UUID, chapter_in: ChapterUpdate):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 构建更新数据
        update_data = {}
        if chapter_in.title is not None:
            update_data["title"] = chapter_in.title
        if chapter_in.status is not None:
            update_data["status"] = chapter_in.status
        
        await ChapterMapper.update_chapter(db, chapter_id, update_data)
        # 获取更新后的章节
        updated_chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        # 构建不包含段落的字典
        chapter_dict = {
            "chapter_id": updated_chapter.chapter_id,
            "document_id": updated_chapter.document_id,
            "title": updated_chapter.title,
            "status": updated_chapter.status,
            "order_index": updated_chapter.order_index,
            "updated_at": updated_chapter.updated_at
        }
        return chapter_dict

    @staticmethod
    async def delete_chapter(db: AsyncSession, chapter_id: UUID):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        await ChapterMapper.delete_chapter(db, chapter)
        return {"message": "删除成功"}

    @staticmethod
    async def get_chapter_toc(db: AsyncSession, chapter_id: UUID):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 获取章节的段落
        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        
        # 提取目录结构
        toc = []
        for para in paragraphs:
            if para.para_type in ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']:
                toc.append({
                    "id": str(para.paragraph_id),
                    "type": para.para_type,
                    "content": para.content,
                    "order_index": para.order_index
                })
        
        return toc


