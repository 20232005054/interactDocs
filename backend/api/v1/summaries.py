from core.response import success_response
from schemas.schemas import DocumentSummaryCreate, DocumentSummaryUpdate
from services.summary_service import SummaryService

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.session import get_db
from pydantic import BaseModel, Field
from typing import Optional, List
from services import ai_service

router = APIRouter(prefix="/api/v1", tags=["摘要管理"])

# AI 帮填摘要请求模型
class AIAssistSummaryRequest(BaseModel):
    document_id: UUID
    summary_ids: Optional[List[str]] = Field(None, description="摘要ID列表，为空则一键生成所有摘要，包含一个ID则帮填该摘要")
    keywords: Optional[List[str]] = Field(None, description="选择的关键词ID列表，不指定则使用所有关键词")

@router.post("/documents/{document_id}/summaries", summary="创建摘要")
async def create_summary(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    创建文档摘要
    """
    # 调用服务层方法创建默认摘要
    new_summary = await SummaryService.create_default_summary(db, document_id)
    
    # 构建返回数据
    result = {
        "summary_id": new_summary.summary_id,
        "document_id": new_summary.document_id,
        "title": new_summary.title,
        "content": new_summary.content,
        "version": new_summary.version,
        "order_index": new_summary.order_index,
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
        "order_index": summary.order_index,
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
    
    # 按 order_index 排序
    sorted_summaries = sorted(summaries, key=lambda x: x.order_index)
    
    # 构建返回数据
    summary_list = []
    for summary in sorted_summaries:
        summary_list.append({
            "summary_id": summary.summary_id,
            "document_id": summary.document_id,
            "title": summary.title,
            "content": summary.content,
            "version": summary.version,
            "order_index": summary.order_index,
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
        "order_index": updated_summary.order_index,
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

@router.post("/summaries/{summary_id}/insert-after", summary="在当前摘要后插入新摘要")
async def insert_summary_after(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    在指定摘要后插入新的默认摘要
    """
    # 调用服务层方法在指定摘要后插入新摘要
    new_summary = await SummaryService.insert_summary_after(db, summary_id)
    if not new_summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    
    # 构建返回数据
    result = {
        "summary_id": new_summary.summary_id,
        "document_id": new_summary.document_id,
        "title": new_summary.title,
        "content": new_summary.content,
        "version": new_summary.version,
        "order_index": new_summary.order_index,
        "created_at": new_summary.created_at,
        "updated_at": new_summary.updated_at
    }
    return success_response(data=result)


@router.get("/summaries/{summary_id}/paragraphs", summary="获取摘要关联的段落信息")
async def get_summary_paragraphs(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取摘要关联的段落信息，包括段落详情和关联的摘要部分
    """
    paragraphs = await SummaryService.get_summary_related_paragraphs(db, summary_id)
    return success_response(data={"paragraphs": paragraphs})

@router.post("/documents/{document_id}/summaries/ai/generate", summary="AI 生成摘要")
async def ai_generate_summaries(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    AI 一键生成所有摘要
    """
    from services import ai_service
    # 调用AI服务生成所有摘要
    summaries = await ai_service.generate_all_summaries(db, document_id)
    if not summaries:
        raise HTTPException(status_code=404, detail="文档不存在")
    return success_response(data={"summaries": summaries})


@router.post("/summaries/{summary_id}/ai/assist", summary="AI 帮填摘要")
async def ai_assist_summary(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    AI 帮填单个摘要
    根据摘要状态自动判断帮填场景：
    - 场景1：无标题无内容 → AI帮填标题和内容
    - 场景2：有标题无内容 → AI只填内容
    - 场景3：无标题有内容 → AI帮填标题
    """
    # 调用AI服务帮填单个摘要
    summary = await ai_service.assist_single_summary(db, str(summary_id))
    if not summary:
        raise HTTPException(status_code=404, detail="摘要不存在")
    return success_response(data=summary)


@router.post("/summaries/{summary_id}/ai/apply", summary="应用AI帮填结果")
async def apply_ai_assist_result(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    应用AI帮填结果，将ai_generate字段的内容填入content字段
    """
    try:
        # 调用服务层方法应用AI帮填结果
        updated_summary = await SummaryService.apply_ai_assist_result(db, summary_id)
        
        # 构建返回数据
        result_data = {
            "summary_id": updated_summary.summary_id,
            "document_id": updated_summary.document_id,
            "title": updated_summary.title,
            "content": updated_summary.content,
            "version": updated_summary.version,
            "order_index": updated_summary.order_index,
            "ai_generate": updated_summary.ai_generate,
            "created_at": updated_summary.created_at,
            "updated_at": updated_summary.updated_at
        }
        
        return success_response(data=result_data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"应用AI帮填结果失败: {e}")
        raise HTTPException(status_code=500, detail="应用AI帮填结果失败")


