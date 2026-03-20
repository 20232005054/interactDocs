from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.paragraph_service import ParagraphService
from services import ai_service
from schemas.schemas import ParagraphCreate, ParagraphUpdate, AIAssistRequest


router = APIRouter(prefix="/api/v1", tags=["段落管理"])

@router.get("/paragraphs/{paragraph_id}", summary="获取段落详情")
async def get_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取段落详情
    """
    paragraph = await ParagraphService.get_paragraph_detail(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    return success_response(data={
        "paragraph_id": paragraph.paragraph_id,
        "chapter_id": paragraph.chapter_id,
        "content": paragraph.content,
        "para_type": paragraph.para_type,
        "order_index": paragraph.order_index,
        "ai_eval": paragraph.ai_eval,
        "ai_suggestion": paragraph.ai_suggestion,
        "ai_generate": paragraph.ai_generate,
        "ischange": paragraph.ischange
    })

@router.post("/chapters/{chapter_id}/paragraphs", summary="创建段落")
async def create_paragraph(chapter_id: UUID, paragraph_in: ParagraphCreate, db: AsyncSession = Depends(get_db)):
    """
    创建段落
    """
    paragraph = await ParagraphService.create_paragraph(db, chapter_id, paragraph_in)
    
    return success_response(data={
        "paragraph_id": paragraph.paragraph_id,
        "chapter_id": paragraph.chapter_id,
        "content": paragraph.content,
        "para_type": paragraph.para_type,
        "order_index": paragraph.order_index,
        "ai_eval": paragraph.ai_eval,
        "ai_suggestion": paragraph.ai_suggestion,
        "ai_generate": paragraph.ai_generate,
        "ischange": paragraph.ischange
    })

@router.put("/paragraphs/{paragraph_id}", summary="更新段落全部信息")
async def update_paragraph(paragraph_id: UUID, paragraph_in: ParagraphUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新段落信息
    """
    updated_paragraph = await ParagraphService.update_paragraph(db, paragraph_id, paragraph_in)
    if not updated_paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    return success_response(data={
        "paragraph_id": updated_paragraph.paragraph_id,
        "chapter_id": updated_paragraph.chapter_id,
        "content": updated_paragraph.content,
        "para_type": updated_paragraph.para_type,
        "order_index": updated_paragraph.order_index,
        "ai_eval": updated_paragraph.ai_eval,
        "ai_suggestion": updated_paragraph.ai_suggestion,
        "ai_generate": updated_paragraph.ai_generate,
        "ischange": updated_paragraph.ischange
    })


@router.delete("/paragraphs/{paragraph_id}", summary="删除段落")
async def delete_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    删除段落
    """
    result = await ParagraphService.delete_paragraph(db, paragraph_id)
    return success_response(data=result)

@router.post("/paragraphs/{paragraph_id}/insert-after", summary="在当前段落后插入新段落")
async def insert_paragraph_after(paragraph_id: UUID, paragraph_in: ParagraphCreate, db: AsyncSession = Depends(get_db)):
    """
    在当前段落后插入新段落
    """
    # 调用服务层方法插入新段落
    new_paragraph = await ParagraphService.insert_paragraph_after(db, paragraph_id, paragraph_in)
    
    return success_response(data={
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

@router.get("/chapters/{chapter_id}/paragraphs", summary="获取章节的段落列表")
async def get_paragraphs_by_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取章节的段落列表
    """
    paragraphs = await ParagraphService.get_paragraphs_by_chapter_id(db, chapter_id)
    
    paragraph_list = []
    for para in paragraphs:
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
    
    return success_response(data={"paragraphs": paragraph_list})

@router.post("/paragraphs/{paragraph_id}/ai/assist", summary="AI 帮填段落内容")
async def ai_assist_paragraph(paragraph_id: UUID, assist_request: AIAssistRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 帮填段落内容
    """
    # 1. 检查段落是否存在
    paragraph = await ParagraphService.get_paragraph_detail(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    # 2. 检查段落类型，只有paragraph类型的段落才能使用AI帮填
    if paragraph.para_type != "paragraph":
        raise HTTPException(status_code=400, detail="只有正文类型的段落才能使用AI帮填功能")
    
    try:
        # 直接调用服务层方法，传入数据库会话
        return StreamingResponse(
            ai_service.ai_assist_paragraph(db, paragraph_id, assist_request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except Exception as e:
        print(f"AI 帮填失败: {e}")
        raise HTTPException(status_code=500, detail="AI 帮填失败")

@router.post("/paragraphs/{paragraph_id}/ai/evaluate", summary="AI 评估段落内容")
async def ai_evaluate_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    AI 评估段落内容
    """
    try:
        # 调用服务层方法获取生成器函数
        evaluate_and_save_func = ai_service.ai_evaluate_paragraph(paragraph_id)
        
        # 调用生成器函数，传入数据库会话
        async def generate_evaluation():
            async for chunk in evaluate_and_save_func(db):
                yield chunk
        
        return StreamingResponse(
            generate_evaluation(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except Exception as e:
        print(f"AI 评估失败: {e}")
        raise HTTPException(status_code=500, detail="AI 评估失败")

@router.post("/paragraphs/{paragraph_id}/ai/apply", summary="应用AI帮填结果")
async def apply_ai_assist_result(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    应用AI帮填结果，将ai_generate字段的内容填充到content字段
    """
    try:
        # 调用服务层方法应用AI帮填结果
        updated_paragraph = await ParagraphService.apply_ai_assist_result(db, paragraph_id)
        
        return success_response(data={
            "paragraph_id": updated_paragraph.paragraph_id,
            "chapter_id": updated_paragraph.chapter_id,
            "content": updated_paragraph.content,
            "para_type": updated_paragraph.para_type,
            "order_index": updated_paragraph.order_index,
            "ai_eval": updated_paragraph.ai_eval,
            "ai_suggestion": updated_paragraph.ai_suggestion,
            "ai_generate": updated_paragraph.ai_generate,
            "ischange": updated_paragraph.ischange
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"应用AI帮填结果失败: {e}")
        raise HTTPException(status_code=500, detail="应用AI帮填结果失败")

@router.get("/paragraphs/{paragraph_id}/summaries", summary="获取段落关联的摘要信息")
async def get_paragraph_summaries(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取段落关联的摘要信息，包括摘要详情和使用的摘要部分
    """
    summaries = await ParagraphService.get_paragraph_related_summaries(db, paragraph_id)
    return success_response(data={"summaries": summaries})

