from core.response import success_response, ResponseModel
from schemas.schemas import DocumentSummaryUpdate
from schemas.response_schemas import SummaryResponse, SummaryWithAIResponse, SummaryListResponse, SummaryAIAssistResponse, SummaryAIGenerateItem, SummaryAIGenerateResponse, SummaryRelatedParagraphsResponse, RelatedParagraphItem
from services.summary_service import SummaryService

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.session import get_db
from pydantic import BaseModel, Field
from typing import Optional, List
from services import ai_service
from core.auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["摘要管理"])


class AIAssistSummaryRequest(BaseModel):
    document_id: UUID
    summary_ids: Optional[List[str]] = Field(None, description="摘要ID列表")
    keywords: Optional[List[str]] = Field(None, description="关键词ID列表")


class SummaryReorderPayload(BaseModel):
    ordered_ids: List[UUID] = Field(..., description="摘要 ID 按新顺序排列的列表")


def _summary_response(s) -> SummaryResponse:
    return SummaryResponse(
        summary_id=s.summary_id,
        document_id=s.document_id,
        title=s.title,
        field_key=s.field_key,
        content=s.content,
        is_change=s.is_change,
        version=s.version,
        order_index=s.order_index,
        created_at=s.created_at,
        updated_at=s.updated_at
    )


@router.post("/documents/{document_id}/summaries", summary="创建摘要", response_model=ResponseModel[SummaryResponse])
async def create_summary(document_id: UUID, db: AsyncSession = Depends(get_db)):
    new_summary = await SummaryService.create_default_summary(db, document_id)
    return success_response(data=_summary_response(new_summary))


@router.get("/summaries/{summary_id}", summary="获取指定摘要详情", response_model=ResponseModel[SummaryResponse])
async def get_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    summary = await SummaryService.get_summary_by_id(db, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    return success_response(data=_summary_response(summary))


@router.get("/documents/{document_id}/summaries", summary="获取文档的摘要列表", response_model=ResponseModel[SummaryListResponse])
async def get_document_summaries(document_id: UUID, db: AsyncSession = Depends(get_db)):
    summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
    sorted_summaries = sorted(summaries, key=lambda x: x.order_index)
    return success_response(data=SummaryListResponse(
        summaries=[_summary_response(s) for s in sorted_summaries]
    ))


@router.put("/summaries/{summary_id}", summary="更新摘要", response_model=ResponseModel[SummaryResponse])
async def update_summary(summary_id: UUID, summary_in: DocumentSummaryUpdate, db: AsyncSession = Depends(get_db)):
    updated = await SummaryService.update_summary(db, summary_id, summary_in)
    if not updated:
        raise HTTPException(status_code=404, detail="摘要不存在")
    return success_response(data=_summary_response(updated))


@router.delete("/summaries/{summary_id}", summary="删除摘要", response_model=ResponseModel[None])
async def delete_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await SummaryService.delete_summary(db, summary_id)
    return success_response(message=result["message"])


@router.post("/summaries/{summary_id}/insert-after", summary="在当前摘要后插入新摘要", response_model=ResponseModel[SummaryResponse])
async def insert_summary_after(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    new_summary = await SummaryService.insert_summary_after(db, summary_id)
    if not new_summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    return success_response(data=_summary_response(new_summary))


@router.get("/summaries/{summary_id}/paragraphs", summary="获取摘要关联的段落信息", response_model=ResponseModel[SummaryRelatedParagraphsResponse])
async def get_summary_paragraphs(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    paragraphs = await SummaryService.get_summary_related_paragraphs(db, summary_id)
    return success_response(data=SummaryRelatedParagraphsResponse(
        paragraphs=[RelatedParagraphItem(**p) for p in paragraphs]
    ))


@router.post("/documents/{document_id}/summaries/ai/generate", summary="AI 生成摘要", response_model=ResponseModel[SummaryAIGenerateResponse])
async def ai_generate_summaries(document_id: UUID, db: AsyncSession = Depends(get_db)):
    summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
    if not summaries:
        raise HTTPException(status_code=404, detail="文档不存在或无摘要")
    results = []
    for s in summaries:
        content = await ai_service.assist_single_summary(db, s.summary_id)
        results.append(SummaryAIGenerateItem(summary_id=s.summary_id, ai_generate=content))
    return success_response(data=SummaryAIGenerateResponse(summaries=results))


@router.post("/summaries/{summary_id}/ai/assist", summary="AI 帮填摘要", response_model=ResponseModel[SummaryAIAssistResponse])
async def ai_assist_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    content = await ai_service.assist_single_summary(db, summary_id)
    if content is None:
        raise HTTPException(status_code=404, detail="摘要不存在")
    return success_response(data=SummaryAIAssistResponse(summary_id=summary_id, ai_generate=content))


@router.post("/summaries/{summary_id}/ai/apply", summary="应用AI帮填结果", response_model=ResponseModel[SummaryWithAIResponse])
async def apply_ai_assist_result(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        updated = await SummaryService.apply_ai_assist_result(db, summary_id)
        return success_response(data=SummaryWithAIResponse(
            summary_id=updated.summary_id,
            document_id=updated.document_id,
            title=updated.title,
            field_key=updated.field_key,
            content=updated.content,
            is_change=updated.is_change,
            version=updated.version,
            order_index=updated.order_index,
            ai_generate=updated.ai_generate,
            created_at=updated.created_at,
            updated_at=updated.updated_at
        ))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="应用AI帮填结果失败")


@router.post("/documents/{document_id}/summaries/reorder", summary="批量重排摘要顺序", response_model=ResponseModel[None])
async def reorder_summaries(
    document_id: UUID,
    payload: SummaryReorderPayload,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await SummaryService.reorder(db, document_id, payload.ordered_ids)
    except HTTPException:
        raise
    return success_response(message="排序更新成功")


@router.post("/summaries/{summary_id}/ai/confirm", summary="确认 AI 重新生成的摘要内容", response_model=ResponseModel[SummaryWithAIResponse])
async def confirm_ai_change(
    summary_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    将 is_change=3 的 AI 重新生成内容写入 content，is_change 归零。
    """
    try:
        updated = await SummaryService.confirm_ai_change(db, summary_id)
        return success_response(data=SummaryWithAIResponse(
            summary_id=updated.summary_id,
            document_id=updated.document_id,
            title=updated.title,
            field_key=updated.field_key,
            content=updated.content,
            is_change=updated.is_change,
            version=updated.version,
            order_index=updated.order_index,
            ai_generate=updated.ai_generate,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        ))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="确认 AI 生成内容失败")


@router.post("/summaries/{summary_id}/ai/reject", summary="拒绝 AI 重新生成的摘要内容", response_model=ResponseModel[SummaryResponse])
async def reject_ai_change(
    summary_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    清空 is_change=3 的 AI 重新生成内容，is_change 归零，保留原 content 不变。
    """
    try:
        updated = await SummaryService.reject_ai_change(db, summary_id)
        return success_response(data=_summary_response(updated))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="拒绝 AI 生成内容失败")
