from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from core.auth import get_current_user
from db.session import get_db
from services.paragraph_service import ParagraphService
from services.langchain.services import ai_service
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
    
    service = ai_service.AIService()
    return StreamingResponse(
        service.ai_assist_paragraph(paragraph_id, instruction=instruction),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/paragraphs/{paragraph_id}/ai/evaluate", summary="AI 评估段落内容")
async def ai_evaluate_paragraph(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    service = ai_service.AIService()
    
    async def generate_evaluation():
        async for chunk in service.ai_evaluate_paragraph(paragraph_id):
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


# ============================================================
# 段落文献管理接口
# ============================================================

@router.post(
    "/paragraphs/{paragraph_id}/literature/upload",
    summary="上传文献并绑定到段落（快速模式）",
    response_model=ResponseModel[dict],
)
async def upload_literature_to_paragraph(
    paragraph_id: UUID,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    authors: Optional[str] = Form(None),
    doi: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    上传文献并绑定到段落（强制快速模式）。
    即使是 admin/editor，段落级上传也用快速模式，因为：
    1. 用户期望立即可用
    2. 段落级引用通常是临时性的
    """
    from services.literature_service import LiteratureService
    from db.mappers.paragraph_literature_mapper import ParagraphLiteratureMapper
    from db.mappers.paragraph_mapper import ParagraphMapper
    from db.mappers.chapter_mapper import ChapterMapper
    from db.mappers.document_mapper import DocumentMapper
    from core.auth import get_current_user
    from fastapi import UploadFile, File, Form
    
    # 验证段落权限
    paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    chapter = await ChapterMapper.get_chapter_by_id(db, paragraph.chapter_id)
    document = await DocumentMapper.get_document_by_id(db, chapter.document_id)
    
    if str(document.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="无权操作此段落")
    
    # 强制 scope=private，触发快速模式
    file_content = await file.read()
    lit = await LiteratureService.upload(
        db,
        file_content=file_content,
        filename=file.filename or "upload.pdf",
        scope="private",  # 强制快速模式
        user_id=current_user.user_id,
    )
    
    # 如果用户填写了元数据，立即写入
    manual_meta = {k: v for k, v in {
        "title": title,
        "authors": authors,
        "doi": doi,
    }.items() if v is not None}
    
    if manual_meta:
        from db.mappers.literature_mapper import LiteratureMapper
        await LiteratureMapper.update_metadata(db, lit.literature_id, manual_meta)
        await db.commit()
        await db.refresh(lit)
    
    # 自动绑定到段落
    await ParagraphLiteratureMapper.bind(db, paragraph_id, lit.literature_id)
    await db.commit()
    
    return success_response(data={
        "literature_id": str(lit.literature_id),
        "literature_key": lit.literature_key,
        "processing_mode": "fast",
        "estimated_time": "3-5秒",
        "bound_to_paragraph": True,
        "upload_status": lit.upload_status,
    })


@router.post(
    "/paragraphs/{paragraph_id}/literature/{literature_id}",
    summary="绑定已有文献到段落",
    response_model=ResponseModel[None],
)
async def bind_literature_to_paragraph(
    paragraph_id: UUID,
    literature_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """绑定已有文献到段落"""
    from services.literature_service import LiteratureService
    from db.mappers.paragraph_literature_mapper import ParagraphLiteratureMapper
    from db.mappers.paragraph_mapper import ParagraphMapper
    from db.mappers.chapter_mapper import ChapterMapper
    from db.mappers.document_mapper import DocumentMapper
    from core.auth import get_current_user
    
    # 验证段落权限
    paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    chapter = await ChapterMapper.get_chapter_by_id(db, paragraph.chapter_id)
    document = await DocumentMapper.get_document_by_id(db, chapter.document_id)
    
    if str(document.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="无权操作此段落")
    
    # 验证文献存在且有权访问
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    
    # private 文献只有上传者可绑定
    if lit.scope == "private" and str(lit.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="只能绑定自己上传的私有文献")
    
    # 绑定
    await ParagraphLiteratureMapper.bind(db, paragraph_id, literature_id)
    await db.commit()
    
    return success_response(message="绑定成功")


@router.delete(
    "/paragraphs/{paragraph_id}/literature/{literature_id}",
    summary="解绑文献与段落",
    response_model=ResponseModel[None],
)
async def unbind_literature_from_paragraph(
    paragraph_id: UUID,
    literature_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """解绑文献与段落"""
    from db.mappers.paragraph_literature_mapper import ParagraphLiteratureMapper
    from db.mappers.paragraph_mapper import ParagraphMapper
    from db.mappers.chapter_mapper import ChapterMapper
    from db.mappers.document_mapper import DocumentMapper
    from core.auth import get_current_user
    
    # 验证段落权限
    paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    chapter = await ChapterMapper.get_chapter_by_id(db, paragraph.chapter_id)
    document = await DocumentMapper.get_document_by_id(db, chapter.document_id)
    
    if str(document.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="无权操作此段落")
    
    # 解绑
    success = await ParagraphLiteratureMapper.unbind(db, paragraph_id, literature_id)
    await db.commit()
    
    if not success:
        raise HTTPException(status_code=404, detail="绑定关系不存在")
    
    return success_response(message="解绑成功")


@router.get(
    "/paragraphs/{paragraph_id}/literature",
    summary="获取段落绑定的文献列表",
    response_model=ResponseModel[dict],
)
async def list_paragraph_literature(
    paragraph_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """获取段落绑定的文献列表"""
    from db.mappers.paragraph_literature_mapper import ParagraphLiteratureMapper
    from db.mappers.paragraph_mapper import ParagraphMapper
    from schemas.response_schemas import LiteratureResponse
    
    # 验证段落存在
    paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
    if not paragraph:
        raise HTTPException(status_code=404, detail="段落不存在")
    
    # 获取绑定的文献列表
    items = await ParagraphLiteratureMapper.list_by_paragraph_id(db, paragraph_id)
    
    return success_response(data={
        "items": [
            LiteratureResponse(
                literature_id=lit.literature_id,
                literature_key=lit.literature_key,
                title=lit.title,
                authors=lit.authors,
                journal=lit.journal,
                publish_date=lit.publish_date,
                doi=lit.doi,
                impact_factor=lit.impact_factor,
                source_file=lit.source_file,
                upload_status=lit.upload_status,
                error_message=lit.error_message,
                scope=lit.scope,
                processing_mode=lit.processing_mode,
                chunk_count=lit.chunk_count,
                user_id=lit.user_id,
                created_at=lit.created_at,
            )
            for lit in items
        ],
        "total": len(items),
    })


@router.post("/paragraphs/{paragraph_id}/confirm-change", summary="确认段落变更", response_model=ResponseModel[ParagraphResponse])
async def confirm_paragraph_change(paragraph_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    确认段落变更，将 ischange 重置为 0。
    用于用户确认已查看并接受段落的变更状态（ischange=1 或 ischange=2）。
    """
    updated = await ParagraphService.confirm_change(db, paragraph_id)
    return success_response(data=_para_response(updated), message="已确认变更")

