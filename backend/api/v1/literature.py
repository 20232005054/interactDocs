"""
文献管理接口

POST   /api/v1/templates/{template_id}/literature          上传文献
GET    /api/v1/templates/{template_id}/literature          获取文献列表
GET    /api/v1/templates/{template_id}/literature/{lid}    获取文献详情
DELETE /api/v1/templates/{template_id}/literature/{lid}    删除文献
POST   /api/v1/templates/{template_id}/literature/{lid}/retry  重新处理失败文献
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.auth import get_current_user
from core.response import success_response, ResponseModel
from core.constants import TemplateType, UserRole
from db.session import get_db
from schemas.response_schemas import LiteratureResponse, LiteratureListResponse
from services.literature_service import LiteratureService
from services.template_service import TemplateService

router = APIRouter(prefix="/api/v1/templates", tags=["文献管理"])


def _lit_response(lit) -> LiteratureResponse:
    return LiteratureResponse(
        literature_id=lit.literature_id,
        template_id=lit.template_id,
        title=lit.title,
        authors=lit.authors,
        journal=lit.journal,
        publish_date=lit.publish_date,
        doi=lit.doi,
        impact_factor=lit.impact_factor,
        source_file=lit.source_file,
        upload_status=lit.upload_status,
        error_message=lit.error_message,
        created_at=lit.created_at,
    )


async def _check_template_write_permission(db, template_id: UUID, current_user):
    """系统模板需要 editor/admin，私有模板需要是创建者"""
    tpl = await TemplateService.get_template(db, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    if tpl.template_type == TemplateType.DOCUMENT_PRIVATE:
        raise HTTPException(status_code=400, detail="文档私有副本不支持上传文献，请在原始模板上操作")
    if tpl.template_type == TemplateType.SYSTEM:
        if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="系统模板需要编辑权限")
    elif tpl.template_type == TemplateType.USER_REUSABLE:
        if str(tpl.user_id) != str(current_user.user_id):
            raise HTTPException(status_code=403, detail="只有模板创建者才能管理文献")
    return tpl


@router.post(
    "/{template_id}/literature",
    summary="上传文献（PDF）",
    response_model=ResponseModel[LiteratureResponse],
)
async def upload_literature(
    template_id: UUID,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    上传 PDF 文献到模板知识库。
    - 立即返回 literature_id 和 pending 状态
    - 后台异步处理：解析 → 向量化 → CrossRef 补全 metadata
    - 前端轮询 GET /{lid} 接口获取处理状态
    """
    await _check_template_write_permission(db, template_id, current_user)
    file_content = await file.read()
    lit = await LiteratureService.upload(db, template_id, file_content, file.filename or "upload.pdf")
    return success_response(data=_lit_response(lit))


@router.get(
    "/{template_id}/literature",
    summary="获取模板的文献列表",
    response_model=ResponseModel[LiteratureListResponse],
)
async def list_literature(
    template_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tpl = await TemplateService.get_template(db, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    items = await LiteratureService.list_by_template(db, template_id)
    return success_response(data=LiteratureListResponse(
        items=[_lit_response(lit) for lit in items],
        total=len(items),
    ))


@router.get(
    "/{template_id}/literature/{literature_id}",
    summary="获取文献详情（含处理状态）",
    response_model=ResponseModel[LiteratureResponse],
)
async def get_literature(
    template_id: UUID,
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit or str(lit.template_id) != str(template_id):
        raise HTTPException(status_code=404, detail="文献不存在")
    return success_response(data=_lit_response(lit))


@router.delete(
    "/{template_id}/literature/{literature_id}",
    summary="删除文献",
    response_model=ResponseModel[None],
)
async def delete_literature(
    template_id: UUID,
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_template_write_permission(db, template_id, current_user)
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit or str(lit.template_id) != str(template_id):
        raise HTTPException(status_code=404, detail="文献不存在")
    await LiteratureService.delete(db, literature_id)
    return success_response(message="删除成功")


@router.post(
    "/{template_id}/literature/{literature_id}/retry",
    summary="重新处理失败的文献",
    response_model=ResponseModel[LiteratureResponse],
)
async def retry_literature(
    template_id: UUID,
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_template_write_permission(db, template_id, current_user)
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit or str(lit.template_id) != str(template_id):
        raise HTTPException(status_code=404, detail="文献不存在")
    updated = await LiteratureService.retry(db, literature_id)
    return success_response(data=_lit_response(updated))
