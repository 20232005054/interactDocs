from core.response import success_response
from schemas.schemas import DocumentKeywordCreate, DocumentKeywordUpdate, DocumentKeywordVO
from services.keyword_service import KeywordService
import services.ai_service as ai_service

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from db.session import get_db
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/v1", tags=["关键词管理"])


@router.post("/documents/{document_id}/keywords", summary="创建关键词")
async def create_keyword(document_id: UUID, keyword_in: DocumentKeywordCreate, db: AsyncSession = Depends(get_db)):
    """
    创建文档关键词
    """
    new_keyword = await KeywordService.create_keyword(db, keyword_in, document_id)
    
    # 构建返回数据
    result = {
        "keyword_id": new_keyword.keyword_id,
        "document_id": new_keyword.document_id,
        "keyword": new_keyword.keyword,
        "created_at": new_keyword.created_at,
        "updated_at": new_keyword.updated_at
    }
    return success_response(data=result)

@router.get("/keywords/{keyword_id}", summary="获取关键词详情")
async def get_keyword(keyword_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取关键词详情
    """
    keyword = await KeywordService.get_keyword_by_id(db, keyword_id)
    if not keyword:
        raise HTTPException(status_code=404, detail="关键词不存在")
    
    # 构建返回数据
    result = {
        "keyword_id": keyword.keyword_id,
        "document_id": keyword.document_id,
        "keyword": keyword.keyword,
        "created_at": keyword.created_at,
        "updated_at": keyword.updated_at
    }
    return success_response(data=result)

@router.get("/documents/{document_id}/keywords", summary="获取文档的关键词列表")
async def get_document_keywords(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档的关键词列表
    """
    keywords = await KeywordService.get_keywords_by_document_id(db, document_id)
    
    # 构建返回数据
    keyword_list = []
    for keyword in keywords:
        keyword_list.append({
            "keyword_id": keyword.keyword_id,
            "document_id": keyword.document_id,
            "keyword": keyword.keyword,
            "created_at": keyword.created_at,
            "updated_at": keyword.updated_at
        })
    
    return success_response(data={"keywords": keyword_list})

@router.put("/keywords/{keyword_id}", summary="更新关键词")
async def update_keyword(keyword_id: UUID, keyword_in: DocumentKeywordUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新关键词内容
    """
    updated_keyword = await KeywordService.update_keyword(db, keyword_id, keyword_in)
    if not updated_keyword:
        raise HTTPException(status_code=404, detail="关键词不存在")
    
    # 构建返回数据
    result = {
        "keyword_id": updated_keyword.keyword_id,
        "document_id": updated_keyword.document_id,
        "keyword": updated_keyword.keyword,
        "created_at": updated_keyword.created_at,
        "updated_at": updated_keyword.updated_at
    }
    return success_response(data=result)

@router.delete("/keywords/{keyword_id}", summary="删除关键词")
async def delete_keyword(keyword_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    删除关键词
    """
    result = await KeywordService.delete_keyword(db, keyword_id)
    return success_response(message=result["message"])

@router.get("/summaries/{summary_id}/keywords", summary="获取摘要关联的关键词信息")
async def get_summary_keywords(summary_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取摘要关联的关键词信息
    """
    keywords = await KeywordService.get_summary_related_keywords(db, summary_id)
    return success_response(data={"keywords": keywords})

@router.get("/paragraphs/{paragraph_id}/keywords", summary="获取段落关联的关键词信息")
async def get_paragraph_keywords(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取段落关联的关键词信息
    """
    keywords = await KeywordService.get_paragraph_related_keywords(db, paragraph_id)
    return success_response(data={"keywords": keywords})



@router.post("/documents/{document_id}/keywords/ai/assist", summary="AI 帮填关键词")
async def ai_assist_keyword(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    AI 帮填关键词
    """
    keywords = await ai_service.ai_assist_keyword(db, document_id)
    return success_response(data={"keywords": keywords})
