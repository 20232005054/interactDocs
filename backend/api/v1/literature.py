"""
文献管理接口

文献知识库（独立资源）：
POST   /api/v1/literature                    上传文献（scope 由角色自动决定）
GET    /api/v1/literature                    查询文献列表（scope/status 过滤）
GET    /api/v1/literature/{id}               获取文献详情
DELETE /api/v1/literature/{id}               删除文献
POST   /api/v1/literature/{id}/retry         重新处理失败文献

模板绑定文献：
POST   /api/v1/templates/{id}/literature/{lit_id}    绑定文献到模板
DELETE /api/v1/templates/{id}/literature/{lit_id}    解绑文献
GET    /api/v1/templates/{id}/literature             获取模板绑定的文献列表
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from core.auth import get_current_user
from core.response import success_response, ResponseModel
from core.constants import TemplateType, UserRole
from db.session import get_db
from schemas.response_schemas import LiteratureResponse, LiteratureListResponse
from schemas.template_schemas import LiteratureUpdate
from services.literature_service import LiteratureService
from services.template_service import TemplateService

# 两个 router，分别挂不同前缀
router = APIRouter(prefix="/api/v1/literature", tags=["文献管理"])
template_router = APIRouter(prefix="/api/v1/templates", tags=["文献管理"])


def _lit_response(lit, user_name: str | None = None) -> LiteratureResponse:
    return LiteratureResponse(
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
        user_name=user_name,
        created_at=lit.created_at,
    )


async def _check_template_bind_permission(db, template_id: UUID, current_user):
    """
    检查用户是否有权限操作模板的文献绑定：
    - type=1 系统模板：需要 editor/admin
    - type=2 用户模板：需要是创建者
    - type=0 私有副本：需要是文档所有者（通过 template.user_id 判断）
    """
    tpl = await TemplateService.get_template(db, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    if tpl.template_type == TemplateType.SYSTEM:
        if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="系统模板需要编辑权限")
    elif tpl.template_type in (TemplateType.USER_REUSABLE, TemplateType.DOCUMENT_PRIVATE):
        if str(tpl.user_id) != str(current_user.user_id):
            raise HTTPException(status_code=403, detail="无权操作此模板的文献")
    return tpl


# ============================================================
# 文献知识库接口
# ============================================================

@router.post(
    "",
    summary="上传文献到知识库",
    response_model=ResponseModel[LiteratureResponse],
)
async def upload_literature(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None, description="文献标题（可选，CrossRef 会自动补全）"),
    authors: Optional[str] = Form(None, description="作者，逗号分隔（可选）"),
    journal: Optional[str] = Form(None, description="期刊名称（可选）"),
    doi: Optional[str] = Form(None, description="DOI（可选，有则跳过自动提取）"),
    impact_factor: Optional[float] = Form(None, description="影响因子（可选）"),
    literature_key: Optional[str] = Form(None, description="文献标识符（跨系统迁移时传入，不传则自动生成）"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    上传 PDF 文献到知识库。
    
    处理模式自动选择：
    - admin/editor 上传 → scope=public → 完整模式（30-60秒，全文分块）
    - 普通用户上传 → scope=private → 快速模式（3-5秒，仅摘要）
    
    可选填元数据（title/authors/journal/doi/impact_factor），填了则跳过对应字段的 CrossRef 自动补全。
    literature_key：跨系统迁移时传入导出方的 key，不传则自动生成。
    
    立即返回 literature_id 和 pending 状态，后台异步处理。
    """
    scope = "public" if current_user.role in (UserRole.EDITOR, UserRole.ADMIN) else "private"
    file_content = await file.read()
    lit = await LiteratureService.upload(
        db,
        file_content=file_content,
        filename=file.filename or "upload.pdf",
        scope=scope,
        user_id=current_user.user_id,
        literature_key=literature_key,
    )
    # 如果用户填写了元数据，立即写入（优先于 CrossRef 自动补全）
    manual_meta = {k: v for k, v in {
        "title": title,
        "authors": authors,
        "journal": journal,
        "doi": doi,
        "impact_factor": impact_factor,
    }.items() if v is not None}
    if manual_meta:
        from db.mappers.literature_mapper import LiteratureMapper
        await LiteratureMapper.update_metadata(db, lit.literature_id, manual_meta)
        await db.commit()
        await db.refresh(lit)
    return success_response(data=_lit_response(lit))


@router.get(
    "",
    summary="查询文献列表",
    response_model=ResponseModel[LiteratureListResponse],
)
async def list_literature(
    scope: Optional[str] = Query(None, description="过滤 scope: public / private"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    - 不传 scope：admin 返回全部，普通用户返回 public + 自己的 private
    - scope=public：返回所有公共文献
    - scope=private：返回当前用户的私有文献
    """
    if scope == "public":
        items = await LiteratureService.list_public(db)
    elif scope == "private":
        if current_user.role in (UserRole.EDITOR, UserRole.ADMIN):
            items = await LiteratureService.list_all_private(db)
        else:
            items = await LiteratureService.list_by_user(db, current_user.user_id)
    else:
        # 无过滤：admin/editor 看全部（public + 所有 private），普通用户看 public + 自己的 private
        public_items = await LiteratureService.list_public(db)
        if current_user.role in (UserRole.EDITOR, UserRole.ADMIN):
            all_items = await LiteratureService.list_all(db)
            items = all_items
        else:
            private_items = await LiteratureService.list_by_user(db, current_user.user_id)
            # 合并去重
            seen = {lit.literature_id for lit in public_items}
            items = list(public_items)
            for lit in private_items:
                if lit.literature_id not in seen:
                    items.append(lit)

    # 批量查询 user_name（只查有 user_id 的文献，避免 N+1）
    user_id_set = {lit.user_id for lit in items if lit.user_id is not None}
    user_name_map: dict = {}
    if user_id_set:
        from db.mappers.user_mapper import UserMapper
        users = await UserMapper.get_by_ids(db, list(user_id_set))
        user_name_map = {u.user_id: u.name for u in users}

    return success_response(data=LiteratureListResponse(
        items=[_lit_response(lit, user_name_map.get(lit.user_id)) for lit in items],
        total=len(items),
    ))


@router.get(
    "/{literature_id}",
    summary="获取文献详情",
    response_model=ResponseModel[LiteratureResponse],
)
async def get_literature(
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    # private 文献只有上传者和 admin 可查看
    if lit.scope == "private":
        if str(lit.user_id) != str(current_user.user_id) and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="无权查看此文献")
    return success_response(data=_lit_response(lit))


@router.delete(
    "/{literature_id}",
    summary="删除文献",
    response_model=ResponseModel[None],
)
async def delete_literature(
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    # public 文献只有 editor/admin 可删；private 文献只有上传者可删
    if lit.scope == "public":
        if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="公共文献需要编辑权限才能删除")
    else:
        if str(lit.user_id) != str(current_user.user_id) and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="只能删除自己上传的文献")
    await LiteratureService.delete(db, literature_id)
    return success_response(message="删除成功")


@router.post(
    "/{literature_id}/retry",
    summary="重新处理失败的文献",
    response_model=ResponseModel[LiteratureResponse],
)
async def retry_literature(
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    if lit.scope == "public":
        if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="公共文献需要编辑权限")
    else:
        if str(lit.user_id) != str(current_user.user_id) and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="只能重试自己上传的文献")
    updated = await LiteratureService.retry(db, literature_id)
    return success_response(data=_lit_response(updated))


@router.put(
    "/{literature_id}",
    summary="更新文献元数据",
    response_model=ResponseModel[LiteratureResponse],
)
async def update_literature(
    literature_id: UUID,
    data: LiteratureUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    手动更新文献元数据（title/authors/journal/doi/impact_factor）。
    用于 CrossRef 自动解析失败时，由用户或管理员手动补充。
    """
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    if lit.scope == "public":
        if current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="公共文献需要编辑权限才能修改")
    else:
        if str(lit.user_id) != str(current_user.user_id) and current_user.role not in (UserRole.EDITOR, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="只能修改自己上传的文献")
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有要更新的数据")
    updated = await LiteratureService.update(db, literature_id, update_data)
    return success_response(data=_lit_response(updated))


# ============================================================
# 模板绑定文献接口
# ============================================================

@template_router.post(
    "/{template_id}/literature/{literature_id}",
    summary="绑定文献到模板",
    response_model=ResponseModel[None],
)
async def bind_literature(
    template_id: UUID,
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_template_bind_permission(db, template_id, current_user)
    lit = await LiteratureService.get_by_id(db, literature_id)
    if not lit:
        raise HTTPException(status_code=404, detail="文献不存在")
    # private 文献只有上传者可绑定
    if lit.scope == "private" and str(lit.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="只能绑定自己上传的私有文献")
    await LiteratureService.bind(db, template_id, literature_id)
    return success_response(message="绑定成功")


@template_router.delete(
    "/{template_id}/literature/{literature_id}",
    summary="解绑文献与模板",
    response_model=ResponseModel[None],
)
async def unbind_literature(
    template_id: UUID,
    literature_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_template_bind_permission(db, template_id, current_user)
    await LiteratureService.unbind(db, template_id, literature_id)
    return success_response(message="解绑成功")


@template_router.get(
    "/{template_id}/literature",
    summary="获取模板绑定的文献列表",
    response_model=ResponseModel[LiteratureListResponse],
)
async def list_template_literature(
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
