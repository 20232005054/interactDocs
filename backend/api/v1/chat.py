"""
对话历史接口

GET  /api/v1/documents/{document_id}/chat-history   分页获取对话历史
DELETE /api/v1/documents/{document_id}/chat-history  清空对话历史
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from core.auth import get_current_user
from core.response import success_response, ResponseModel
from db.session import get_db
from db.mappers.chat_mapper import ChatMapper

router = APIRouter(prefix="/api/v1/documents", tags=["对话历史"])


class ChatRecordItem(BaseModel):
    chat_id: UUID
    document_id: UUID
    chapter_id: Optional[UUID] = None
    role: str
    message: str
    response: Optional[str] = None
    mode: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ChatRecordItem]


@router.get(
    "/{document_id}/chat-history",
    summary="获取文档对话历史",
    response_model=ResponseModel[ChatHistoryResponse],
)
async def get_chat_history(
    document_id: UUID,
    page: int = 1,
    page_size: int = 20,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, records = await ChatMapper.get_by_document_id(db, document_id, page, page_size)
    return success_response(data=ChatHistoryResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[
            ChatRecordItem(
                chat_id=r.chat_id,
                document_id=r.document_id,
                chapter_id=r.chapter_id,
                role=r.role or "user",
                message=r.message,
                response=r.response,
                mode=r.mode or "chat",
                created_at=r.created_at,
            )
            for r in records
        ],
    ))


@router.delete(
    "/{document_id}/chat-history",
    summary="清空文档对话历史",
    response_model=ResponseModel[None],
)
async def clear_chat_history(
    document_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await ChatMapper.delete_by_document_id(db, document_id)
    await db.commit()
    return success_response(message=f"已清空 {count} 条对话记录")
