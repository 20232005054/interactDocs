from core.response import success_response, ResponseModel
from schemas.schemas import ChapterUpdate
from schemas.response_schemas import ChapterResponse, ChapterTreeResponse, ChapterTocResponse
from services.chapter_service import ChapterService
from services import ai_service
from core.auth import get_current_user

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from db.session import get_db

router = APIRouter(prefix="/api/v1", tags=["章节管理"])


class ChapterReorder(BaseModel):
    parent_id: Optional[UUID] = None
    ordered_ids: List[UUID]


@router.get("/chapters/document/{document_id}/tree", summary="获取文档章节层级目录", response_model=ResponseModel[ChapterTreeResponse])
async def get_chapter_tree(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from schemas.response_schemas import ChapterTreeNode
    tree_data = await ChapterService.get_chapter_tree(db, document_id)

    def build_node(d) -> ChapterTreeNode:
        return ChapterTreeNode(
            chapter_id=d["chapter_id"],
            document_id=d["document_id"],
            parent_id=d.get("parent_id"),
            title=d["title"],
            field_key=d.get("field_key"),
            status=d["status"],
            order_index=d["order_index"],
            updated_at=d["updated_at"],
            children=[build_node(c) for c in d.get("children", [])]
        )

    return success_response(data=ChapterTreeResponse(tree=[build_node(n) for n in tree_data]))


@router.get("/chapters/{chapter_id}", summary="获取章节段落详情", response_model=ResponseModel[ChapterResponse])
async def get_chapter_detail(chapter_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from schemas.response_schemas import ParagraphInChapter
    d = await ChapterService.get_chapter_detail(db, chapter_id)
    return success_response(data=ChapterResponse(
        chapter_id=d["chapter_id"],
        document_id=d["document_id"],
        parent_id=d.get("parent_id"),
        title=d["title"],
        field_key=d.get("field_key"),
        status=d["status"],
        order_index=d["order_index"],
        updated_at=d["updated_at"],
        paragraphs=[ParagraphInChapter(**p) for p in d.get("paragraphs", [])]
    ))


@router.put("/chapters/{chapter_id}", summary="修改章节信息", response_model=ResponseModel[ChapterResponse])
async def update_chapter(chapter_id: UUID, chapter_in: ChapterUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    d = await ChapterService.update_chapter(db, chapter_id, chapter_in)
    return success_response(data=ChapterResponse(
        chapter_id=d["chapter_id"],
        document_id=d["document_id"],
        parent_id=d.get("parent_id"),
        title=d["title"],
        field_key=d.get("field_key"),
        status=d["status"],
        order_index=d["order_index"],
        updated_at=d["updated_at"]
    ))


@router.post("/chapters/{document_id}", summary="新增章节", response_model=ResponseModel[ChapterResponse])
async def create_chapter(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = await ChapterService.create_chapter(db, document_id)
    return success_response(data=ChapterResponse(
        chapter_id=c.chapter_id,
        document_id=c.document_id,
        parent_id=c.parent_id,
        title=c.title,
        field_key=c.field_key,
        status=c.status,
        order_index=c.order_index,
        updated_at=c.updated_at,
        paragraphs=[]
    ))


@router.post("/chapters/{document_id}/sub/{parent_id}", summary="新增子章节", response_model=ResponseModel[ChapterResponse])
async def create_sub_chapter(document_id: UUID, parent_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = await ChapterService.create_sub_chapter(db, document_id, parent_id)
    return success_response(data=ChapterResponse(
        chapter_id=c.chapter_id,
        document_id=c.document_id,
        parent_id=c.parent_id,
        title=c.title,
        field_key=c.field_key,
        status=c.status,
        order_index=c.order_index,
        updated_at=c.updated_at,
        paragraphs=[]
    ))


@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await ChapterService.delete_chapter(db, chapter_id)
    return success_response(message=result["message"])


@router.post("/chapters/{document_id}/insert-after/{after_chapter_id}", summary="在指定章节后插入同级章节", response_model=ResponseModel[ChapterResponse])
async def insert_chapter_after(document_id: UUID, after_chapter_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = await ChapterService.insert_chapter_after(db, document_id, after_chapter_id)
    return success_response(data=ChapterResponse(
        chapter_id=c.chapter_id,
        document_id=c.document_id,
        parent_id=c.parent_id,
        title=c.title,
        field_key=c.field_key,
        status=c.status,
        order_index=c.order_index,
        updated_at=c.updated_at,
        paragraphs=[]
    ))


@router.post("/chapters/{document_id}/reorder", summary="拖拽重排章节（支持跨父节点移动）")
async def reorder_chapters(document_id: UUID, data: ChapterReorder, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        await ChapterService.reorder_chapters(db, document_id, data.parent_id, data.ordered_ids)
    except HTTPException:
        raise
    return success_response(message="排序更新成功")


@router.get("/chapters/{chapter_id}/toc", summary="获取章节内容目录", response_model=ResponseModel[ChapterTocResponse])
async def get_chapter_toc(chapter_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from schemas.response_schemas import TocItem
    toc = await ChapterService.get_chapter_toc(db, chapter_id)
    return success_response(data=ChapterTocResponse(toc=[TocItem(**t) for t in toc]))

