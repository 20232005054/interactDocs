from services.document_service import DocumentService
from services.template_apply_service import TemplateApplyService
from services.document_snapshot_service import DocumentSnapshotService
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from schemas.document_schemas import DocumentCreate, DocumentUpdate, SnapshotUpdate, PaginationParams, ExportTemplatePayload
from schemas.response_schemas import (
    DocumentResponse, DocumentDetailResponse, DocumentListResponse,
    DocumentListItem,
    SnapshotResponse, SnapshotListResponse,
    ApplyCoreInfoResponse, ApplySummaryResponse, ApplyStructureResponse, ApplyCoreInfoItem,
    ApplySummaryItem, ApplyStructureItem,
    TemplateInfoResponse, FullContentResponse, FullContentChapter, FullContentParagraph,
    TemplateDetailResponse,
)
from core.response import success_response, ResponseModel
from core.auth import get_current_user
from db.session import get_db


router = APIRouter(prefix="/api/v1/documents", tags=["文档管理"])


@router.post("", summary="创建新文档", response_model=ResponseModel[DocumentResponse])
async def create_document(
    doc_in: DocumentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_document = await DocumentService.create_document(db, doc_in, user_id=current_user.user_id)
    return success_response(data=DocumentResponse(
        document_id=new_document.document_id,
        title=new_document.title,
        purpose=new_document.purpose,
        template_id=new_document.template_id,
        created_at=new_document.created_at,
        updated_at=new_document.updated_at
    ))


@router.get("", summary="获取文档列表", response_model=ResponseModel[DocumentListResponse])
async def list_documents(
    pagination: PaginationParams = Depends(),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, documents = await DocumentService.list_documents(db, pagination, user_id=current_user.user_id)
    items = [
        DocumentListItem(
            document_id=item["doc"].document_id,
            title=item["doc"].title,
            purpose=item["doc"].purpose,
            template_purpose=item["purpose"],
            template_name=item["display_name"],
            created_at=item["doc"].created_at,
            updated_at=item["doc"].updated_at
        )
        for item in documents
    ]
    return success_response(data=DocumentListResponse(
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        items=items
    ))


@router.get("/{document_id}", summary="获取文档详情", response_model=ResponseModel[DocumentDetailResponse])
async def get_document(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    document, template_name = await DocumentService.get_document(db, document_id)
    return success_response(data=DocumentDetailResponse(
        document_id=document.document_id,
        title=document.title,
        purpose=document.purpose,
        template_id=document.template_id,
        template_name=template_name,
        created_at=document.created_at,
        updated_at=document.updated_at
    ))


@router.put("/{document_id}", summary="更新文档信息", response_model=ResponseModel[DocumentResponse])
async def update_document(document_id: UUID, doc_in: DocumentUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    document = await DocumentService.update_document(db, document_id, doc_in)
    return success_response(data=DocumentResponse(
        document_id=document.document_id,
        title=document.title,
        purpose=document.purpose,
        template_id=document.template_id,
        created_at=document.created_at,
        updated_at=document.updated_at
    ))


@router.delete("/{document_id}", summary="删除文档", response_model=ResponseModel[None])
async def delete_document(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await DocumentService.delete_document(db, document_id)
    return success_response(message=result["message"])


@router.get("/{document_id}/snapshots", summary="获取文档快照列表", response_model=ResponseModel[SnapshotListResponse])
async def get_document_snapshots(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    snapshots = await DocumentSnapshotService.get_document_snapshots(db, document_id)
    return success_response(data=SnapshotListResponse(
        snapshots=[SnapshotResponse(**s) for s in snapshots]
    ))


@router.get("/{document_id}/snapshots/detail/{snapshot_id}", summary="获取快照详情", response_model=ResponseModel[SnapshotResponse])
async def get_snapshot_detail(document_id: UUID, snapshot_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    snapshot = await DocumentSnapshotService.get_snapshot_detail(db, document_id, snapshot_id)
    return success_response(data=SnapshotResponse(**snapshot))


@router.post("/{document_id}/snapshots", summary="创建文档快照", response_model=ResponseModel[SnapshotResponse])
async def create_document_snapshot(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    snapshot = await DocumentSnapshotService.create_document_snapshot(db, document_id)
    return success_response(data=SnapshotResponse(**snapshot))


@router.put("/snapshots/{snapshot_id}", summary="更新快照信息", response_model=ResponseModel[SnapshotResponse])
async def update_snapshot(
    snapshot_id: UUID,
    snapshot_in: SnapshotUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await DocumentSnapshotService.update_snapshot(db, snapshot_id, snapshot_in.description)
    return success_response(data=SnapshotResponse(**snapshot))


@router.post("/{document_id}/snapshots/{snapshot_id}/restore", summary="从快照恢复文档", response_model=ResponseModel[None])
async def restore_snapshot(
    document_id: UUID,
    snapshot_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await DocumentSnapshotService.restore_snapshot(db, document_id, snapshot_id)
    return success_response(message=result["message"])


@router.get("/{document_id}/full-content", summary="获取文档全量内容（章节树+段落）", response_model=ResponseModel[FullContentResponse])
async def get_full_content(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doc_id, tree = await DocumentService.get_full_content(db, document_id)

    def build_chapter_node(node) -> FullContentChapter:
        chapter = node["chapter"]
        return FullContentChapter(
            chapter_id=chapter.chapter_id,
            document_id=chapter.document_id,
            parent_id=chapter.parent_id,
            title=chapter.title,
            field_key=chapter.field_key,
            status=chapter.status,
            order_index=chapter.order_index,
            updated_at=chapter.updated_at,
            paragraphs=[
                FullContentParagraph(
                    paragraph_id=p.paragraph_id,
                    chapter_id=p.chapter_id,
                    content=p.content,
                    para_type=p.para_type,
                    order_index=p.order_index,
                    para_def_idx=p.para_def_idx,
                    ai_eval=p.ai_eval,
                    ai_suggestion=p.ai_suggestion,
                    ai_generate=p.ai_generate,
                    ischange=p.ischange,
                )
                for p in node["paragraphs"]
            ],
            children=[build_chapter_node(child) for child in node["children"]],
        )

    return success_response(data=FullContentResponse(
        document_id=doc_id,
        tree=[build_chapter_node(n) for n in tree],
    ))


@router.get("/{document_id}/template-info", summary="获取文档关联的模板完整信息", response_model=ResponseModel[TemplateInfoResponse])
async def get_template_info(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template_info = await DocumentService.get_template_info(db, document_id)
    return success_response(data=template_info)


@router.post("/{document_id}/apply-core-info-template", summary="应用核心信息模板", response_model=ResponseModel[ApplyCoreInfoResponse])
async def apply_core_info_template(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tree, count = await TemplateApplyService.apply_core_info_template_as_tree(db, document_id)
    return success_response(data=ApplyCoreInfoResponse(
        message=f"成功创建 {count} 个核心信息字段",
        items=tree
    ))


@router.post("/{document_id}/apply-summary-template", summary="应用摘要模板", response_model=ResponseModel[ApplySummaryResponse])
async def apply_summary_template(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    created_items = await TemplateApplyService.apply_summary_template(db, document_id)
    return success_response(data=ApplySummaryResponse(
        message=f"成功创建 {len(created_items)} 个摘要",
        items=[
            ApplySummaryItem(
                summary_id=str(item["summary"].summary_id),
                title=item["summary"].title,
                field_key=item["summary"].field_key,
                content=item["summary"].content,
                order_index=item["summary"].order_index,
                generation_mode=item["generation_mode"],
                sources=item["sources"],
                degraded=item.get("degraded", False),
                generation_error=item.get("generation_error"),
            )
            for item in created_items
        ]
    ))


@router.post("/{document_id}/apply-structure-template", summary="应用文章结构模板", response_model=ResponseModel[ApplyStructureResponse])
async def apply_structure_template(document_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    created_items = await TemplateApplyService.apply_structure_template(db, document_id)
    return success_response(data=ApplyStructureResponse(
        message=f"成功创建 {len(created_items)} 个章节",
        items=[
            ApplyStructureItem(
                chapter_id=str(item["chapter"].chapter_id),
                parent_id=str(item["chapter"].parent_id) if item["chapter"].parent_id else None,
                field_key=item["chapter"].field_key,
                title=item["chapter"].title,
                order_index=item["chapter"].order_index,
                paragraph_count=len(item.get("paragraphs") or []),
                paragraphs=[
                    FullContentParagraph(
                        paragraph_id=p.paragraph_id,
                        chapter_id=p.chapter_id,
                        content=p.content,
                        para_type=p.para_type,
                        order_index=p.order_index,
                        para_def_idx=p.para_def_idx,
                        ai_eval=p.ai_eval,
                        ai_suggestion=p.ai_suggestion,
                        ai_generate=p.ai_generate,
                        ischange=p.ischange,
                    )
                    for p in (item.get("paragraphs") or [])
                ],
                degraded=item.get("degraded", False),
                generation_error=item.get("generation_error"),
            )
            for item in created_items
        ]
    ))


@router.post("/{document_id}/export-template", summary="将文档模板导出到个人模板库", response_model=ResponseModel[TemplateDetailResponse])
async def export_template(
    document_id: UUID,
    payload: ExportTemplatePayload,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await DocumentService.export_template(
        db, document_id, current_user.user_id, payload.display_name
    )
    return success_response(data=TemplateDetailResponse(
        template_id=template.template_id,
        group_id=template.group_id,
        document_id=template.document_id,
        purpose=template.purpose,
        display_name=template.display_name,
        content=template.content,
        version=template.version,
        template_type=template.template_type,
        user_id=template.user_id,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    ))



