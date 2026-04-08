"""
SSE 事件推送接口

GET /api/v1/documents/{document_id}/events

前端建立长连接后，后台任务完成时会推送事件，格式：
  {"type": "summary_updated", "summary_id": "..."}
  {"type": "paragraph_updated", "chapter_id": "...", "paragraph_id": "..."}
  {"type": "ping"}  心跳，每 30s 一次
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from uuid import UUID

from services.event_bus import event_generator

router = APIRouter(prefix="/api/v1/documents", tags=["事件推送"])


@router.get("/{document_id}/events", summary="订阅文档变更事件（SSE）")
async def document_events(document_id: UUID):
    return StreamingResponse(
        event_generator(str(document_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲，确保实时推送
        },
    )
