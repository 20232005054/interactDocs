
from core.response import success_response
from schemas.schemas import ChapterUpdate
from services.chapter_service import ChapterService
from services import ai_service

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from db.session import get_db

router = APIRouter(prefix="/api/v1", tags=["章节管理"])


class ChapterReorder(BaseModel):
    parent_id: Optional[UUID] = None
    ordered_ids: List[UUID]



@router.get("/chapters/document/{document_id}/tree", summary="获取文档章节层级目录")
async def get_chapter_tree(document_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取文档的章节目录（层级树状结构）
    """
    tree = await ChapterService.get_chapter_tree(db, document_id)
    return success_response(data={"tree": tree})

@router.get("/chapters/{chapter_id}", summary="获取章节段落详情")
async def get_chapter_detail(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    chapter_data = await ChapterService.get_chapter_detail(db, chapter_id)
    # 构建返回数据
    result = {
        "chapter_id": chapter_data["chapter_id"],
        "document_id": chapter_data["document_id"],
        "parent_id": chapter_data.get("parent_id"),
        "title": chapter_data["title"],
        "status": chapter_data["status"],
        "order_index": chapter_data["order_index"],
        "updated_at": chapter_data["updated_at"],
        "paragraphs": chapter_data["paragraphs"]
    }
    return success_response(data=result)

@router.put("/chapters/{chapter_id}", summary="修改章节信息")
async def update_chapter(chapter_id: UUID, chapter_in: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    # 打印接收到的数据
    print(f"接收到的 chapter_in: {chapter_in}")
    
    chapter_data = await ChapterService.update_chapter(db, chapter_id, chapter_in)
    # 构建返回数据
    result = {
        "chapter_id": chapter_data["chapter_id"],
        "document_id": chapter_data["document_id"],
        "parent_id": chapter_data.get("parent_id"),
        "title": chapter_data["title"],
        "status": chapter_data["status"],
        "order_index": chapter_data["order_index"],
        "updated_at": chapter_data["updated_at"]
    }
    return success_response(data=result)

@router.post("/chapters/{document_id}", summary="新增章节")
async def create_chapter(document_id: UUID, db: AsyncSession = Depends(get_db)):
    # 使用默认值创建章节
    new_chapter = await ChapterService.create_chapter(db, document_id)
    # 构建返回数据
    chapter_data = {
        "chapter_id": new_chapter.chapter_id,
        "document_id": new_chapter.document_id,
        "parent_id": new_chapter.parent_id,
        "title": new_chapter.title,
        "status": new_chapter.status,
        "order_index": new_chapter.order_index,
        "updated_at": new_chapter.updated_at,
        "paragraphs": []
    }
    return success_response(data=chapter_data)

@router.post("/chapters/{document_id}/sub/{parent_id}", summary="新增子章节")
async def create_sub_chapter(document_id: UUID, parent_id: UUID, db: AsyncSession = Depends(get_db)):
    # 使用默认值创建子章节
    new_chapter = await ChapterService.create_sub_chapter(db, document_id, parent_id)
    # 构建返回数据
    chapter_data = {
        "chapter_id": new_chapter.chapter_id,
        "document_id": new_chapter.document_id,
        "parent_id": new_chapter.parent_id,
        "title": new_chapter.title,
        "status": new_chapter.status,
        "order_index": new_chapter.order_index,
        "updated_at": new_chapter.updated_at,
        "paragraphs": []
    }
    return success_response(data=chapter_data)


@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await ChapterService.delete_chapter(db, chapter_id)
    return success_response(message=result["message"])


@router.post("/chapters/{document_id}/insert-after/{after_chapter_id}", summary="在指定章节后插入同级章节")
async def insert_chapter_after(document_id: UUID, after_chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    new_chapter = await ChapterService.insert_chapter_after(db, document_id, after_chapter_id)
    return success_response(data={
        "chapter_id": new_chapter.chapter_id,
        "document_id": new_chapter.document_id,
        "parent_id": new_chapter.parent_id,
        "title": new_chapter.title,
        "status": new_chapter.status,
        "order_index": new_chapter.order_index,
        "updated_at": new_chapter.updated_at,
        "paragraphs": []
    })


@router.post("/chapters/{document_id}/reorder", summary="拖拽重排章节（支持跨父节点移动）")
async def reorder_chapters(document_id: UUID, data: ChapterReorder, db: AsyncSession = Depends(get_db)):
    try:
        await ChapterService.reorder_chapters(db, document_id, data.parent_id, data.ordered_ids)
    except HTTPException:
        raise
    return success_response(message="排序更新成功")

@router.get("/chapters/{chapter_id}/toc", summary="获取章节内容目录")
async def get_chapter_toc(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    获取章节内容的目录结构，从章节的段落中提取标题信息
    """
    toc = await ChapterService.get_chapter_toc(db, chapter_id)
    return success_response(data={"toc": toc})

@router.post("/chapters/{chapter_id}/generate-content", summary="从摘要生成章节内容")
async def generate_chapter_content(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    从摘要生成章节内容
    """
    # 返回流式响应
    return StreamingResponse(
        ai_service.generate_chapter_content_stream(db, chapter_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )





