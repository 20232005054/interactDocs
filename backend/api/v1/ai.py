import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from db.models import Document, ChatRecord, Chapter
from schemas.schemas import AIChatRequest
from services.ai_client import call_qwen_stream

router = APIRouter(prefix="/api/v1/ai")


@router.post("/chat", summary="与 AI 助理对话")
async def ai_chat_stream(request: AIChatRequest, db: AsyncSession = Depends(get_db)):
    # 1. 获取文档上下文，预加载关键词
    from sqlalchemy.orm import joinedload
    doc_res = await db.execute(
        select(Document)
        .options(joinedload(Document.keywords))
        .where(Document.document_id == request.document_id)
    )
    doc = doc_res.unique().scalar_one_or_none()

    # 2. 获取章节信息（如果提供了章节 ID）
    chapter = None
    chapter_content = None
    chapter_title = ""
    if request.current_chapter_id:
        chapter_res = await db.execute(select(Chapter).where(Chapter.chapter_id == request.current_chapter_id))
        chapter = chapter_res.scalar_one_or_none()
        if chapter:
            chapter_content = chapter.content
            # 直接使用章节的title字段
            chapter_title = chapter.title

    # 3. 获取最近 5 条历史对话以保持连贯性
    history_res = await db.execute(
        select(ChatRecord)
        .where(ChatRecord.document_id == request.document_id)
        .order_by(ChatRecord.created_at.desc())
        .limit(5)
    )
    history = history_res.scalars().all()
    history_msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": h.message} for i, h in enumerate(reversed(history))]

    # 4. 构建系统 Prompt
    prompt_parts = [
        "你是一位临床研究 AI 助手，话很少，请直接回答。",
        f"当前项目：{doc.title}"
    ]
    
    # 处理关键词
    if doc.keywords:
        keyword_list = [keyword.keyword for keyword in doc.keywords]
        prompt_parts.append(f"关键词：{', '.join(keyword_list)}")
    else:
        prompt_parts.append("关键词：无")
    
    if doc.abstract:
        prompt_parts.append(f"正文摘要：{doc.abstract}")
    if doc.content:
        prompt_parts.append(f"参考正文：{doc.content}")
    if doc.purpose:
        prompt_parts.append(f"使用目的：{doc.purpose}")
    
    # 添加章节信息
    if chapter:
        if chapter_title:
            prompt_parts.append(f"当前章节：{chapter_title}")
        if chapter_content:
            # 将 JSONB 类型的章节内容转换为字符串
            prompt_parts.append(f"章节内容：{json.dumps(chapter_content)}")
    
    # 添加用户选中的信息
    if request.selected_paragraphs:
        selected_paragraphs_text = "\n".join([f"段落 {i+1}：{p.get('content', '')}" for i, p in enumerate(request.selected_paragraphs)])
        prompt_parts.append(f"用户选中的段落：\n{selected_paragraphs_text}")
    
    if request.selected_keywords:
        selected_keywords_text = ", ".join([k.get('keyword', '') for k in request.selected_keywords])
        prompt_parts.append(f"用户选中的关键词：{selected_keywords_text}")
    
    if request.selected_summaries:
        selected_summaries_text = "\n".join([f"摘要 {i+1}：{s.get('title', '')} - {s.get('content', '')}" for i, s in enumerate(request.selected_summaries)])
        prompt_parts.append(f"用户选中的摘要：\n{selected_summaries_text}")
    
    prompt_parts.append("你的任务是协助用户完善方案。如果用户要求修改某个指标，请给出专业建议。")
    prompt_parts.append("如果你的回答涉及具体的章节修改，请在回复末尾以 JSON 格式提供 action 指令。")
    prompt_parts.append("格式示例：[ACTION]{\"type\": \"update_chapter\", \"chapter_id\": \"xxx\", \"content\": \"...\"}")
    
    system_prompt = "\n".join(prompt_parts)

    async def chat_generator():
        full_response = ""
        # 调用百炼流式接口
        async for chunk in call_qwen_stream(system_prompt, history_msgs, request.message):
            full_response += chunk
            yield f"data: {json.dumps({'response': chunk})}\n\n"
        
        # 解析AI响应，分离回复内容和action指令
        response_text = full_response
        actions = []
        
        # 检查是否包含[ACTION]指令
        if '[ACTION]' in full_response:
            parts = full_response.split('[ACTION]')
            response_text = parts[0].strip()
            if len(parts) > 1:
                try:
                    action_json = json.loads(parts[1].strip())
                    actions.append(action_json)
                except json.JSONDecodeError:
                    pass
        
        # 发送解析后的响应和action
        yield f"data: {json.dumps({'response': response_text, 'actions': actions})}\n\n"
        
        # 5. 存入数据库
        new_record = ChatRecord(
            user_id=None,  # 临时设置为None，实际项目中应该从JWT中获取用户ID
            document_id=request.document_id,
            chapter_id=request.current_chapter_id,
            chapter_content=chapter_content,
            message=request.message,
            response=full_response,
            mode="chat"
        )
        db.add(new_record)
        await db.commit()
        yield "data: [DONE]\n\n"

    return StreamingResponse(chat_generator(), media_type="text/event-stream")

