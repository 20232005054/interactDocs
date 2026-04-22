from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from schemas.document_schemas import AIChatRequest
from services.ai_chat_service import AIChatService

router = APIRouter(prefix="/api/v1/ai")


@router.post(
    "/chat",
    summary="与 AI 助理对话",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "SSE 流式响应，Content-Type: text/event-stream",
            "content": {
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "example": (
                            'data: {"response": "AI回复的文字片段"}\n\n'
                            'data: {"response": "继续的内容", "actions": [{"type": "suggest_edit", ...}]}\n\n'
                            "data: [DONE]\n\n"
                        ),
                    }
                }
            },
        }
    },
)
async def ai_chat_stream(request: AIChatRequest):
    """
    AI 聊天流式接口（Server-Sent Events）

    每个 SSE 事件格式：
    - `data: {"response": "chunk"}` — 流式文字片段
    - `data: {"response": "...", "actions": [...]}` — 含操作指令的最终片段
    - `data: [DONE]` — 流结束标志
    """
    async def chat_generator():
        async for chunk in AIChatService.chat_stream(
            document_id=request.document_id,
            message=request.message,
            current_chapter_id=request.current_chapter_id,
            selected_paragraphs=request.selected_paragraphs,
            selected_summaries=request.selected_summaries
        ):
            yield chunk

    return StreamingResponse(
        chat_generator(),
        media_type="text/event-stream"
    )
