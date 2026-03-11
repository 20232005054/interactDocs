from core.response import success_response
from schemas.schemas import DocumentSummaryCreate, DocumentSummaryUpdate, DocumentSummaryVO
from services.summary_service import SummaryService

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.session import get_db
from pydantic import BaseModel, Field
from typing import Optional, List

router = APIRouter(prefix="/api/v1", tags=["摘要管理"])

# AI 帮填摘要请求模型
class AIAssistSummaryRequest(BaseModel):
    document_id: UUID
    summary_ids: Optional[List[str]] = Field(None, description="摘要ID列表，为空则一键生成所有摘要，包含一个ID则帮填该摘要")
    keywords: Optional[List[str]] = Field(None, description="选择的关键词ID列表，不指定则使用所有关键词")

@router.post("/summaries", summary="创建摘要")
async def create_summary(summary_in: DocumentSummaryCreate, db: AsyncSession = Depends(get_db)):
    """
    创建文档摘要
    """
    new_summary = await SummaryService.create_summary(db, summary_in)
    
    # 构建返回数据
    result = {
        "summary_id": new_summary.summary_id,
        "document_id": new_summary.document_id,
        "title": new_summary.title,
        "content": new_summary.content,
        "version": new_summary.version,
        "created_at": new_summary.created_at,
        "updated_at": new_summary.updated_at
    }
    return success_response(data=result)

@router.get("/summaries/{summary_id}", summary="获取指定摘要详情")
async def get_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取指定摘要详情
    """
    summary = await SummaryService.get_summary_by_id(db, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    
    # 构建返回数据
    result = {
        "summary_id": summary.summary_id,
        "document_id": summary.document_id,
        "title": summary.title,
        "content": summary.content,
        "version": summary.version,
        "created_at": summary.created_at,
        "updated_at": summary.updated_at
    }
    return success_response(data=result)

@router.get("/documents/{document_id}/summaries", summary="获取文档的摘要列表")
async def get_document_summaries(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档的摘要列表
    """
    summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
    
    # 构建返回数据
    summary_list = []
    for summary in summaries:
        summary_list.append({
            "summary_id": summary.summary_id,
            "document_id": summary.document_id,
            "title": summary.title,
            "content": summary.content,
            "version": summary.version,
            "created_at": summary.created_at,
            "updated_at": summary.updated_at
        })
    
    return success_response(data={"summaries": summary_list})



@router.put("/summaries/{summary_id}", summary="更新摘要")
async def update_summary(summary_id: UUID, summary_in: DocumentSummaryUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新摘要内容
    """
    updated_summary = await SummaryService.update_summary(db, summary_id, summary_in)
    if not updated_summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    
    # 构建返回数据
    result = {
        "summary_id": updated_summary.summary_id,
        "document_id": updated_summary.document_id,
        "title": updated_summary.title,
        "content": updated_summary.content,
        "version": updated_summary.version,
        "created_at": updated_summary.created_at,
        "updated_at": updated_summary.updated_at
    }
    return success_response(data=result)

@router.delete("/summaries/{summary_id}", summary="删除摘要")
async def delete_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    删除摘要
    """
    result = await SummaryService.delete_summary(db, summary_id)
    return success_response(message=result["message"])

@router.get("/paragraphs/{paragraph_id}/summaries", summary="获取段落关联的摘要信息")
async def get_paragraph_summaries(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取段落关联的摘要信息，包括摘要详情和使用的摘要部分
    """
    summaries = await SummaryService.get_paragraph_related_summaries(db, paragraph_id)
    return success_response(data={"summaries": summaries})

@router.get("/summaries/{summary_id}/paragraphs", summary="获取摘要关联的段落信息")
async def get_summary_paragraphs(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取摘要关联的段落信息，包括段落详情和关联的摘要部分
    """
    paragraphs = await SummaryService.get_summary_related_paragraphs(db, summary_id)
    return success_response(data={"paragraphs": paragraphs})

@router.post("/summaries/ai/assist", summary="AI 帮填摘要")
async def ai_assist_summary(request: AIAssistSummaryRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 帮填摘要
    - 当summary_ids为空时：一键生成所有摘要
    - 当summary_ids包含一个ID时：帮填指定摘要（根据摘要状态自动判断帮填场景）
    """
    if not request.summary_ids:
        # 一键生成所有摘要
        summaries = await SummaryService.generate_all_summaries(db, request.document_id, request.keywords)
        if not summaries:
            raise HTTPException(status_code=404, detail="文档不存在")
        return success_response(data={"summaries": summaries})
    elif len(request.summary_ids) == 1:
        # 帮填单个摘要
        summary_id = request.summary_ids[0]
        summary = await SummaryService.assist_single_summary(db, summary_id, request.keywords)
        if not summary:
            raise HTTPException(status_code=404, detail="摘要不存在")
        return success_response(data=summary)
    else:
        raise HTTPException(status_code=400, detail="summary_ids只能为空或包含一个ID")

# 批量创建摘要请求模型
class BatchSummaryCreate(BaseModel):
    summaries: List[DocumentSummaryCreate]

@router.post("/summaries/batch", summary="批量创建摘要")
async def batch_create_summaries(request: BatchSummaryCreate, db: AsyncSession = Depends(get_db)):
    """
    批量创建摘要（不调用AI，直接传入JSON列表）
    """
    created_summaries = []
    for summary_in in request.summaries:
        new_summary = await SummaryService.create_summary(db, summary_in)
        created_summaries.append({
            "summary_id": new_summary.summary_id,
            "document_id": new_summary.document_id,
            "title": new_summary.title,
            "content": new_summary.content,
            "version": new_summary.version,
            "created_at": new_summary.created_at,
            "updated_at": new_summary.updated_at
        })
    return success_response(data={"summaries": created_summaries})

# 批量更新摘要order_index请求模型
class BatchSummaryOrderUpdate(BaseModel):
    document_id: UUID
    summary_orders: List[dict]  # 格式: [{"summary_id": "摘要ID", "order_index": 新顺序}]

@router.put("/documents/{document_id}/summaries/order", summary="批量更新摘要顺序")
async def batch_update_summary_order(document_id: UUID, request: BatchSummaryOrderUpdate, db: AsyncSession = Depends(get_db)):
    """
    批量更新文档内所有摘要的order_index顺序
    """
    # 验证document_id是否与请求体中的document_id一致
    if document_id != request.document_id:
        raise HTTPException(status_code=400, detail="文档ID不匹配")
    
    updated_summaries = []
    for item in request.summary_orders:
        summary_id = UUID(item.get("summary_id"))
        order_index = item.get("order_index")
        
        # 验证摘要是否属于指定文档
        from sqlalchemy import select
        from db.models import DocumentSummary
        result = await db.execute(
            select(DocumentSummary).where(
                DocumentSummary.summary_id == summary_id,
                DocumentSummary.document_id == document_id
            )
        )
        summary = result.scalar_one_or_none()
        if not summary:
            raise HTTPException(status_code=404, detail=f"摘要 {summary_id} 不存在或不属于文档 {document_id}")
        
        # 更新order_index
        from sqlalchemy import update
        await db.execute(
            update(DocumentSummary)
            .where(DocumentSummary.summary_id == summary_id)
            .values(order_index=order_index)
        )
        
        # 获取更新后的摘要
        updated_result = await db.execute(
            select(DocumentSummary).where(DocumentSummary.summary_id == summary_id)
        )
        updated_summary = updated_result.scalar_one_or_none()
        if updated_summary:
            updated_summaries.append({
                "summary_id": updated_summary.summary_id,
                "document_id": updated_summary.document_id,
                "order_index": updated_summary.order_index
            })
    
    await db.commit()
    return success_response(data={"summaries": updated_summaries})
