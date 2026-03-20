from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from schemas.schemas import AIChatRequest
from services.ai_chat_service import AIChatService

router = APIRouter(prefix="/api/v1/ai")


@router.post("/chat", summary="与 AI 助理对话")
async def ai_chat_stream(request: AIChatRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 聊天流式接口
    """
    async def chat_generator():
        async for chunk in AIChatService.chat_stream(
            db=db,
            document_id=request.document_id,
            message=request.message,
            current_chapter_id=request.current_chapter_id,
            selected_paragraphs=request.selected_paragraphs,
            selected_keywords=request.selected_keywords,
            selected_summaries=request.selected_summaries
        ):
            yield chunk

    return StreamingResponse(
        chat_generator(),
        media_type="text/event-stream"
    )
