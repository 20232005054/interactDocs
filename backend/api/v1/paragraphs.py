from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from db.session import get_db
from services.paragraph_service import ParagraphService
from services import ai_service
from schemas.document_schemas import ParagraphCreate, ParagraphUpdate, AIAssistRequest
from schemas.response_schemas import ParagraphResponse, ParagraphListResponse, ParagraphRelatedSummariesResponse, RelatedSummaryItem

router = APIRouter(prefix="/api/v1", tags=["段落管理"])


class ParagraphReorderItem(BaseModel):
    paragraph_id: UUID
    chapter_id: UUID
    order_index: int


class ParagraphReorderPayload(BaseModel):
    items: List[ParagraphReorderItem]


def _para_response(p) -> ParagraphResponse:
    return ParagraphResponse(
        paragraph_id=p.paragraph_id,
        chapter_id=p.chapter_id,
        content=p.content,
        para_type=p.para_type,
        order_index=p.order_index,
        ai_eval=p.ai_eval,
        ai_suggestion=p.ai_suggestion,
        ai_generate=p.ai_generate,
        ai_instruction=p.ai_instruction,
        ischange=p.ischange
    )


@router.get("/paragraphs/{paragraph_id}", summary="获取段落详情", response_model=ResponseModel[ParagraphResponse])
async def get_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    paragraph = await ParagraphService.get_paragraph_detail(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    return success_response(data=_para_response(paragraph))


@router.post("/chapters/{chapter_id}/paragraphs", summary="创建段落", response_model=ResponseModel[ParagraphResponse])
async def create_paragraph(chapter_id: UUID, paragraph_in: ParagraphCreate, db: AsyncSession = Depends(get_db)):
    paragraph = await ParagraphService.create_paragraph(db, chapter_id, paragraph_in)
    return success_response(data=_para_response(paragraph))


@router.put("/paragraphs/{paragraph_id}", summary="更新段落全部信息", response_model=ResponseModel[ParagraphResponse])
async def update_paragraph(paragraph_id: UUID, paragraph_in: ParagraphUpdate, db: AsyncSession = Depends(get_db)):
    updated = await ParagraphService.update_paragraph(db, paragraph_id, paragraph_in)
    if not updated:
        raise HTTPException(status_code=404, detail="段落不存在")
    return success_response(data=_para_response(updated))


@router.delete("/paragraphs/{paragraph_id}", summary="删除段落")
async def delete_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await ParagraphService.delete_paragraph(db, paragraph_id)
    return success_response(message=result["message"])


@router.post("/paragraphs/{paragraph_id}/insert-after", summary="在当前段落后插入新段落", response_model=ResponseModel[ParagraphResponse])
async def insert_paragraph_after(paragraph_id: UUID, paragraph_in: ParagraphCreate, db: AsyncSession = Depends(get_db)):
    new_paragraph = await ParagraphService.insert_paragraph_after(db, paragraph_id, paragraph_in)
    return success_response(data=_para_response(new_paragraph))


@router.get("/chapters/{chapter_id}/paragraphs", summary="获取章节的段落列表", response_model=ResponseModel[ParagraphListResponse])
async def get_paragraphs_by_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    paragraphs = await ParagraphService.get_paragraphs_by_chapter_id(db, chapter_id)
    return success_response(data=ParagraphListResponse(
        paragraphs=[_para_response(p) for p in paragraphs]
    ))


@router.post("/paragraphs/{paragraph_id}/ai/assist", summary="AI 帮填段落内容")
async def ai_assist_paragraph(paragraph_id: UUID, assist_request: AIAssistRequest, db: AsyncSession = Depends(get_db)):
    paragraph = await ParagraphService.get_paragraph_detail(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    if paragraph.para_type != "paragraph":
        raise HTTPException(status_code=400, detail="只有正文类型的段落才能使用AI帮填功能")
    
    instruction = assist_request.instruction if assist_request.instruction else None
    print(f"[AI帮填] paragraph_id={paragraph_id}, instruction={instruction!r}")
    
    return StreamingResponse(
        ai_service.ai_assist_paragraph(paragraph_id, assist_request, instruction=instruction),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/paragraphs/{paragraph_id}/ai/evaluate", summary="AI 评估段落内容")
async def ai_evaluate_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    evaluate_and_save_func = ai_service.ai_evaluate_paragraph(paragraph_id)

    async def generate_evaluation():
        async for chunk in evaluate_and_save_func():
            yield chunk

    return StreamingResponse(
        generate_evaluation(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/paragraphs/{paragraph_id}/ai/apply", summary="应用AI帮填结果", response_model=ResponseModel[ParagraphResponse])
async def apply_ai_assist_result(
    paragraph_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    try:
        updated = await ParagraphService.apply_ai_assist_result(db, paragraph_id)
        return success_response(data=_para_response(updated))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="应用AI帮填结果失败")


@router.get("/paragraphs/{paragraph_id}/summaries", summary="获取段落关联的摘要信息", response_model=ResponseModel[ParagraphRelatedSummariesResponse])
async def get_paragraph_summaries(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    summaries = await ParagraphService.get_paragraph_related_summaries(db, paragraph_id)
    return success_response(data=ParagraphRelatedSummariesResponse(
        summaries=[RelatedSummaryItem(**s) for s in summaries]
    ))


@router.post("/documents/{document_id}/paragraphs/reorder", summary="批量重排段落（支持跨章节移动）", response_model=ResponseModel[None])
async def reorder_paragraphs(document_id: UUID, payload: ParagraphReorderPayload, db: AsyncSession = Depends(get_db)):
    await ParagraphService.reorder_paragraphs(db, document_id, payload.items)
    return success_response(message="排序更新成功")
