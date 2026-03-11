
from core.response import success_response
from schemas.schemas import ChapterUpdate, ChapterCreate, ParagraphCreate, ParagraphUpdate, AIAssistRequest, AIEvaluateRequest
from services.ai_service import get_ai_streaming_content, get_ai_evaluation
from services.chapter_service import ChapterService
from services.paragraph_service import ParagraphService
from services.summary_service import SummaryService

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import json
from db.session import get_db
from db.models import Document, Chapter, Paragraph, OperationHistory
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/v1", tags=["章节管理"])

@router.get("/documents/{document_id}/chapters", summary="获取文档章节列表")
async def get_chapters(document_id: UUID, db: AsyncSession = Depends(get_db)):
    chapters = await ChapterService.get_chapters_by_document_id(db, document_id)
    
    # 构建返回数据
    chapter_list = []
    for chapter in chapters:
        # 构建段落数据
        paragraph_list = []
        for para in chapter["paragraphs"]:
            paragraph_list.append({
                "paragraph_id": para.paragraph_id,
                "chapter_id": para.chapter_id,
                "content": para.content,
                "para_type": para.para_type,
                "order_index": para.order_index,
                "ai_eval": para.ai_eval,
                "ai_suggestion": para.ai_suggestion,
                "ai_generate": para.ai_generate,
                "ischange": para.ischange
            })
        
        chapter_list.append({
            "chapter_id": chapter["chapter_id"],
            "document_id": chapter["document_id"],
            "parent_id": chapter["parent_id"],
            "title": chapter["title"],
            "status": chapter["status"],
            "order_index": chapter["order_index"],
            "updated_at": chapter["updated_at"],
            "paragraphs": paragraph_list
        })
    
    return success_response(data={"chapters": chapter_list})

@router.get("/chapters/{chapter_id}", summary="获取章节详情")
async def get_chapter_detail(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    chapter = await ChapterService.get_chapter_detail(db, chapter_id)
    
    # 构建段落数据
    paragraph_list = []
    for para in chapter["paragraphs"]:
        paragraph_list.append({
            "paragraph_id": para.paragraph_id,
            "chapter_id": para.chapter_id,
            "content": para.content,
            "para_type": para.para_type,
            "order_index": para.order_index,
            "ai_eval": para.ai_eval,
            "ai_suggestion": para.ai_suggestion,
            "ai_generate": para.ai_generate,
            "ischange": para.ischange
        })
    
    # 构建返回数据
    result = {
        "chapter_id": chapter["chapter_id"],
        "document_id": chapter["document_id"],
        "parent_id": chapter["parent_id"],
        "title": chapter["title"],
        "status": chapter["status"],
        "order_index": chapter["order_index"],
        "updated_at": chapter["updated_at"],
        "paragraphs": paragraph_list
    }
    return success_response(data=result)

@router.put("/chapters/{chapter_id}", summary="更新章节信息")
async def update_chapter(chapter_id: UUID, chapter_in: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    # 打印接收到的数据
    print(f"接收到的 chapter_in: {chapter_in}")
    
    updated_chapter = await ChapterService.update_chapter(db, chapter_id, chapter_in)
    
    # 构建段落数据
    paragraph_list = []
    for para in updated_chapter["paragraphs"]:
        paragraph_list.append({
            "paragraph_id": para.paragraph_id,
            "chapter_id": para.chapter_id,
            "content": para.content,
            "para_type": para.para_type,
            "order_index": para.order_index,
            "ai_eval": para.ai_eval,
            "ai_suggestion": para.ai_suggestion,
            "ai_generate": para.ai_generate,
            "ischange": para.ischange
        })
    
    # 构建返回数据
    result_data = {
        "chapter_id": updated_chapter["chapter_id"],
        "document_id": updated_chapter["document_id"],
        "parent_id": updated_chapter["parent_id"],
        "title": updated_chapter["title"],
        "status": updated_chapter["status"],
        "order_index": updated_chapter["order_index"],
        "updated_at": updated_chapter["updated_at"],
        "paragraphs": paragraph_list
    }
    
    return success_response(data=result_data)


@router.post("/chapters/{chapter_id}/ai/assist", summary="AI 帮填段落内容")
async def ai_assist_chapter(chapter_id: UUID, assist_request: AIAssistRequest, db: AsyncSession = Depends(get_db)):
    # 1. 查询章节信息及其所属文档的元数据，预加载关键词
    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(Chapter, Document)
        .join(Document, Chapter.document_id == Document.document_id)
        .options(joinedload(Document.keywords))
        .where(Chapter.chapter_id == chapter_id)
    )
    data = result.first()

    if not data:
        raise HTTPException(status_code=404, detail="章节或文档不存在")

    chapter, document = data

    # 2. 找到指定的段落
    paragraph_id = assist_request.paragraph_id
    para_result = await db.execute(
        select(Paragraph).where(Paragraph.paragraph_id == paragraph_id)
    )
    target_paragraph = para_result.scalar_one_or_none()

    if not target_paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")

    # 3. 提取当前段落的所有层级标题
    hierarchy_titles = []
    para_result = await db.execute(
        select(Paragraph).where(Paragraph.chapter_id == chapter_id).order_by(Paragraph.order_index)
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

    # 4. 获取摘要信息
    summary_sections = None
    used_summary_ids = []
    
    if assist_request.summary_sections:
        # 根据用户传入的摘要ID列表获取对应的摘要内容
        summaries = []
        for summary_id in assist_request.summary_sections:
            summary = await SummaryService.get_summary_by_id(db, summary_id)
            if summary:
                summaries.append(f"{summary.title}：\n{summary.content}")
                used_summary_ids.append(summary_id)
        if summaries:
            summary_sections = "\n\n".join(summaries)
    else:
        # 不指定摘要时，获取文档的所有摘要
        all_summaries = await SummaryService.get_summaries_by_document_id(db, document.document_id)
        if all_summaries:
            summaries = []
            for summary in all_summaries:
                summaries.append(f"{summary.title}：\n{summary.content}")
                used_summary_ids.append(str(summary.summary_id))
            if summaries:
                summary_sections = "\n\n".join(summaries)

    # 5. 处理关键词
    document_keywords = []
    used_keyword_ids = []
    
    if assist_request.keywords:
        # 根据用户传入的关键词ID列表获取对应的关键词内容
        from db.mappers.keyword_mapper import KeywordMapper
        for keyword_id in assist_request.keywords:
            keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
            if keyword:
                document_keywords.append(keyword.keyword)
                used_keyword_ids.append(keyword_id)
    else:
        # 不指定关键词时，使用所有关键词
        if document.keywords:
            for keyword in document.keywords:
                document_keywords.append(keyword.keyword)
                used_keyword_ids.append(str(keyword.keyword_id))

    # 6. 定义内部包装器，以便在流结束后更新数据库
    async def generate_and_save():
        full_content = ""
        # 获取流式输出内容
        # 传递文档标题、关键词、章节标题、层级标题、摘要信息
        chapter_title = chapter.title
        
        async for chunk in get_ai_streaming_content(
            document.title, 
            document_keywords, 
            chapter_title,
            hierarchy_titles,
            target_paragraph.content,
            summary_sections
        ):
            # 提取 JSON 中的 content 字段用于拼接
            try:
                chunk_data = json.loads(chunk.replace("data: ", "").strip())
                if "content" in chunk_data:
                    full_content += chunk_data["content"]
            except:
                pass
            yield chunk

        # 流结束后，将最终内容存入数据库
        from sqlalchemy import update
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(
                ai_generate=full_content
            )
        )
        await db.commit()

        # 建立段落与摘要的关联
        if used_summary_ids:
            for summary_id_str in used_summary_ids:
                try:
                    summary_id = UUID(summary_id_str)
                    summary = await SummaryService.get_summary_by_id(db, summary_id)
                    if summary:
                        # 直接关联用户选定的摘要，不需要匹配内容
                        await SummaryService.create_paragraph_summary_link(
                            db, paragraph_id, summary.summary_id
                        )
                except:
                    pass

        # 建立段落与关键词的关联
        if used_keyword_ids:
            from services.keyword_service import KeywordService
            for keyword_id_str in used_keyword_ids:
                try:
                    keyword_id = UUID(keyword_id_str)
                    # 直接关联用户选定的关键词，不需要匹配内容
                    await KeywordService.create_keyword_paragraph_link(
                        db, keyword_id, paragraph_id
                    )
                except Exception as e:
                    print(f"创建关键词关联失败: {e}")
                    pass

        # 发送结束标识
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate_and_save(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/chapters/{chapter_id}/history", summary="获取章节操作历史")
async def get_chapter_history(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    # 查询章节是否存在
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.chapter_id == chapter_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="章节不存在")
    
    # 查询章节的操作历史
    history_result = await db.execute(
        select(OperationHistory)
        .where(OperationHistory.chapter_id == chapter_id)
        .order_by(OperationHistory.created_at.desc())
    )
    history = history_result.scalars().all()
    
    # 构建返回数据
    history_list = []
    for item in history:
        history_list.append({
            "history_id": item.history_id,
            "chapter_id": item.chapter_id,
            "document_id": item.document_id,
            "user_id": item.user_id,
            "action": item.action,
            "content_before": item.content_before,
            "content_after": item.content_after,
            "created_at": item.created_at
        })
    
    return success_response(data={"history": history_list})


@router.post("/chapters/{chapter_id}/ai/evaluate", summary="AI 评估段落内容")
async def ai_evaluate_chapter(chapter_id: UUID, evaluate_request: AIEvaluateRequest, db: AsyncSession = Depends(get_db)):
    # 查询章节信息及其所属文档的元数据
    result = await db.execute(
        select(Chapter, Document)
        .join(Document, Chapter.document_id == Document.document_id)
        .where(Chapter.chapter_id == chapter_id)
    )
    data = result.first()

    if not data:
        raise HTTPException(status_code=404, detail="章节或文档不存在")

    chapter, document = data
    
    # 找到指定的段落
    paragraph_id = evaluate_request.paragraph_id
    para_result = await db.execute(
        select(Paragraph).where(Paragraph.paragraph_id == paragraph_id)
    )
    target_paragraph = para_result.scalar_one_or_none()

    if not target_paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")

    paragraph_content = target_paragraph.content
    if not paragraph_content:
        raise HTTPException(status_code=400, detail="段落内容为空，无法评估")
    
    # 提取当前段落的所有层级标题
    hierarchy_titles = []
    paragraph_title = ""
    para_result = await db.execute(
        select(Paragraph).where(Paragraph.chapter_id == chapter_id).order_by(Paragraph.order_index)
    )
    paragraphs = para_result.scalars().all()
    
    for para in paragraphs:
        if para.para_type in ['heading-1', 'heading-2', 'heading-3']:
            hierarchy_titles.append({
                "type": para.para_type,
                "content": para.content
            })
            # 最后一个标题作为段落标题
            paragraph_title = para.content
        if para.paragraph_id == paragraph_id:
            break
    
    # 直接使用章节的title字段
    chapter_title = chapter.title
    
    # 获取摘要信息
    summary_sections = None
    # 对于AI评估，使用段落相关联的摘要
    related_summaries = await SummaryService.get_paragraph_related_summaries(db, paragraph_id)
    if related_summaries:
        summaries = []
        for summary_info in related_summaries:
            summaries.append(f"{summary_info['title']}：\n{summary_info['content']}")
        if summaries:
            summary_sections = "\n\n".join(summaries)
    
    # 调用AI服务进行评估
    evaluation, suggestions = await get_ai_evaluation(
        document.title,
        document.keywords,
        chapter_title,
        hierarchy_titles,
        paragraph_title,
        paragraph_content,
        summary_sections
    )
    
    # 更新段落的评估结果
    from sqlalchemy import update
    await db.execute(
        update(Paragraph)
        .where(Paragraph.paragraph_id == paragraph_id)
        .values(
            ai_eval=evaluation,
            ai_suggestion="\n".join(suggestions)
        )
    )
    await db.commit()
    
    # 建立段落与摘要的关联 - 由于使用的是已关联的摘要，不需要重新创建关联
    pass
    
    return success_response(data={"evaluation": evaluation, "suggestions": suggestions})


@router.post("/chapters", summary="新增章节")
async def create_chapter(chapter_in: ChapterCreate, db: AsyncSession = Depends(get_db)):
    new_chapter = await ChapterService.create_chapter(db, chapter_in)
    
    # 构建返回数据
    result = {
        "chapter_id": new_chapter.chapter_id,
        "document_id": new_chapter.document_id,
        "parent_id": new_chapter.parent_id,
        "title": new_chapter.title,
        "status": new_chapter.status,
        "order_index": new_chapter.order_index,
        "updated_at": new_chapter.updated_at,
        "paragraphs": []
    }
    return success_response(data=result)


@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await ChapterService.delete_chapter(db, chapter_id)
    return success_response(message=result["message"])

# 批量创建章节请求模型
class BatchChapterCreate(BaseModel):
    chapters: List[ChapterCreate]

@router.post("/chapters/batch", summary="批量创建章节")
async def batch_create_chapters(request: BatchChapterCreate, db: AsyncSession = Depends(get_db)):
    """
    批量创建章节
    """
    created_chapters = []
    for chapter_in in request.chapters:
        new_chapter = await ChapterService.create_chapter(db, chapter_in)
        created_chapters.append({
            "chapter_id": new_chapter.chapter_id,
            "document_id": new_chapter.document_id,
            "parent_id": new_chapter.parent_id,
            "title": new_chapter.title,
            "status": new_chapter.status,
            "order_index": new_chapter.order_index,
            "updated_at": new_chapter.updated_at,
            "paragraphs": []
        })
    return success_response(data={"chapters": created_chapters})


@router.get("/chapters/{chapter_id}/toc", summary="获取章节内容目录")
async def get_chapter_toc(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取章节内容的目录结构，从章节的段落中提取标题信息
    """
    toc = await ChapterService.get_chapter_toc(db, chapter_id)
    return success_response(data={"toc": toc})

@router.post("/documents/{document_id}/chapters/generate", summary="从摘要生成正文章节")
async def generate_chapters_from_summary(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    从摘要一键生成正文章节
    """
    result = await ChapterService.generate_chapters_from_summary(db, document_id)
    return success_response(data=result)


# 段落管理接口
@router.post("/chapters/{chapter_id}/paragraphs", summary="创建段落")
async def create_paragraph(chapter_id: UUID, paragraph_in: ParagraphCreate, db: AsyncSession = Depends(get_db)):
    new_paragraph = await ParagraphService.create_paragraph(db, chapter_id, paragraph_in)
    
    # 构建返回数据
    result = {
        "paragraph_id": new_paragraph.paragraph_id,
        "chapter_id": new_paragraph.chapter_id,
        "content": new_paragraph.content,
        "para_type": new_paragraph.para_type,
        "order_index": new_paragraph.order_index,
        "ai_eval": new_paragraph.ai_eval,
        "ai_suggestion": new_paragraph.ai_suggestion,
        "ai_generate": new_paragraph.ai_generate,
        "ischange": new_paragraph.ischange
    }
    return success_response(data=result)


@router.put("/paragraphs/{paragraph_id}", summary="更新段落")
async def update_paragraph(paragraph_id: UUID, paragraph_in: ParagraphUpdate, db: AsyncSession = Depends(get_db)):
    updated_paragraph = await ParagraphService.update_paragraph(db, paragraph_id, paragraph_in)
    
    # 构建返回数据
    result = {
        "paragraph_id": updated_paragraph.paragraph_id,
        "chapter_id": updated_paragraph.chapter_id,
        "content": updated_paragraph.content,
        "para_type": updated_paragraph.para_type,
        "order_index": updated_paragraph.order_index,
        "ai_eval": updated_paragraph.ai_eval,
        "ai_suggestion": updated_paragraph.ai_suggestion,
        "ai_generate": updated_paragraph.ai_generate,
        "ischange": updated_paragraph.ischange
    }
    return success_response(data=result)


@router.delete("/paragraphs/{paragraph_id}", summary="删除段落")
async def delete_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await ParagraphService.delete_paragraph(db, paragraph_id)
    return success_response(message=result["message"])


@router.get("/paragraphs/{paragraph_id}", summary="获取段落详情")
async def get_paragraph_detail(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    paragraph = await ParagraphService.get_paragraph_detail(db, paragraph_id)
    
    # 构建返回数据
    result = {
        "paragraph_id": paragraph.paragraph_id,
        "chapter_id": paragraph.chapter_id,
        "content": paragraph.content,
        "para_type": paragraph.para_type,
        "order_index": paragraph.order_index,
        "ai_eval": paragraph.ai_eval,
        "ai_suggestion": paragraph.ai_suggestion,
        "ai_generate": paragraph.ai_generate,
        "ischange": paragraph.ischange
    }
    return success_response(data=result)

# 批量创建段落请求模型
class BatchParagraphCreate(BaseModel):
    chapter_id: UUID
    paragraphs: List[ParagraphCreate]

@router.post("/chapters/{chapter_id}/paragraphs/batch", summary="批量创建段落")
async def batch_create_paragraphs(chapter_id: UUID, request: BatchParagraphCreate, db: AsyncSession = Depends(get_db)):
    """
    批量创建段落
    """
    # 验证chapter_id是否与请求体中的chapter_id一致
    if chapter_id != request.chapter_id:
        raise HTTPException(status_code=400, detail="章节ID不匹配")
    
    created_paragraphs = []
    for paragraph_in in request.paragraphs:
        new_paragraph = await ParagraphService.create_paragraph(db, chapter_id, paragraph_in)
        created_paragraphs.append({
            "paragraph_id": new_paragraph.paragraph_id,
            "chapter_id": new_paragraph.chapter_id,
            "content": new_paragraph.content,
            "para_type": new_paragraph.para_type,
            "order_index": new_paragraph.order_index,
            "ai_eval": new_paragraph.ai_eval,
            "ai_suggestion": new_paragraph.ai_suggestion,
            "ai_generate": new_paragraph.ai_generate,
            "ischange": new_paragraph.ischange
        })
    return success_response(data={"paragraphs": created_paragraphs})

# 批量更新段落order_index请求模型
class BatchParagraphOrderUpdate(BaseModel):
    paragraph_orders: List[dict]  # 格式: [{"paragraph_id": "段落ID", "order_index": 新顺序}]

@router.put("/chapters/{chapter_id}/paragraphs/order", summary="批量更新段落顺序")
async def batch_update_paragraph_order(chapter_id: UUID, request: BatchParagraphOrderUpdate, db: AsyncSession = Depends(get_db)):
    """
    批量更新章节内所有段落的order_index顺序
    """
    updated_paragraphs = []
    for item in request.paragraph_orders:
        paragraph_id = UUID(item.get("paragraph_id"))
        order_index = item.get("order_index")
        
        # 验证段落是否属于指定章节
        from sqlalchemy import select
        from db.models import Paragraph
        result = await db.execute(
            select(Paragraph).where(
                Paragraph.paragraph_id == paragraph_id,
                Paragraph.chapter_id == chapter_id
            )
        )
        paragraph = result.scalar_one_or_none()
        if not paragraph:
            raise HTTPException(status_code=404, detail=f"段落 {paragraph_id} 不存在或不属于章节 {chapter_id}")
        
        # 更新order_index
        from sqlalchemy import update
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(order_index=order_index)
        )
        
        # 获取更新后的段落
        updated_result = await db.execute(
            select(Paragraph).where(Paragraph.paragraph_id == paragraph_id)
        )
        updated_paragraph = updated_result.scalar_one_or_none()
        if updated_paragraph:
            updated_paragraphs.append({
                "paragraph_id": updated_paragraph.paragraph_id,
                "chapter_id": updated_paragraph.chapter_id,
                "order_index": updated_paragraph.order_index
            })
    
    await db.commit()
    return success_response(data={"paragraphs": updated_paragraphs})


