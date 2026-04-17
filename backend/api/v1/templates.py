from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import json

from core.response import success_response, ResponseModel
from db.session import get_db
from services.template_service import TemplateService
from schemas.response_schemas import TemplateResponse, TemplateDetailResponse, TemplateListResponse, TemplateSimpleListResponse, PurposeListResponse, TemplateDependenciesResponse
from schemas.schemas import ExportTemplatePayload, TemplateContent, TemplateCreatePayload, TemplateUpdatePayload
from core.auth import get_editor_user, get_admin_user, get_current_user
from core.constants import TemplateType

router = APIRouter(prefix="/api/v1/templates", tags=["模板管理"])


def _template_response(t) -> TemplateResponse:
    return TemplateResponse(
        template_id=t.template_id,
        group_id=t.group_id,
        purpose=t.purpose,
        display_name=t.display_name,
        content=t.content,
        version=t.version,
        template_type=t.template_type,
        user_id=t.user_id,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.get("/{template_id}/dependencies", summary="获取模板依赖关系", response_model=ResponseModel[TemplateDependenciesResponse])
async def get_template_dependencies(template_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await TemplateService.get_template_dependencies(db, template_id)
    return success_response(data=result)


@router.get("/{template_id}/export", summary="导出模板为 JSON 文件")
async def export_template_json(template_id: UUID, db: AsyncSession = Depends(get_db)):
    """将模板主表及三类子表导出为 JSON 文件，可用于备份或跨环境迁移。"""
    data = await TemplateService.export_template_json(db, template_id)
    from urllib.parse import quote
    raw_name = data["template"]["display_name"].replace("/", "_").replace("\\", "_")
    # HTTP 头只支持 latin-1，中文文件名用 RFC 5987 编码
    encoded_name = quote(raw_name + ".json", safe="")
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"
        },
    )


@router.post("/import", summary="从 JSON 文件导入模板", response_model=ResponseModel[TemplateDetailResponse])
async def import_template_json(
    file: UploadFile = File(...),
    current_user=Depends(get_editor_user),
    db: AsyncSession = Depends(get_db),
):
    """上传由 /export 导出的 JSON 文件，创建为当前用户的可复用模板（type=2）。"""
    if file.size and file.size > 1 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过 1MB")
    try:
        content = await file.read()
        raw = content.decode("utf-8")
        # 修复 AI 生成 JSON 时常见的非法转义序列（如 \* \_ \[ \l \g 等）
        import re
        raw = re.sub(r'\\([*_\[\]()!#+\-.>`lgLG])', r'\1', raw)
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="文件格式错误，请上传有效的 JSON 文件")

    t = await TemplateService.import_template_json(db, data, user_id=current_user.user_id)
    return success_response(data=TemplateDetailResponse(
        template_id=t.template_id, group_id=t.group_id, document_id=t.document_id,
        purpose=t.purpose, display_name=t.display_name, content=t.content,
        version=t.version, template_type=t.template_type, user_id=t.user_id,
        is_active=t.is_active, created_at=t.created_at, updated_at=t.updated_at,
    ))


@router.post("", summary="创建模板", response_model=ResponseModel[TemplateDetailResponse])
async def create_template(
    data: TemplateCreatePayload,
    editor=Depends(get_editor_user),
    db: AsyncSession = Depends(get_db)
):
    content_dict = data.content.model_dump(exclude_none=True) if data.content else {}
    t = await TemplateService.create_template(db, data.purpose, data.display_name, content_dict, data.template_type, data.user_id)
    return success_response(data=TemplateDetailResponse(
        template_id=t.template_id, group_id=t.group_id, document_id=t.document_id,
        purpose=t.purpose, display_name=t.display_name, content=t.content,
        version=t.version, template_type=t.template_type, user_id=t.user_id,
        is_active=t.is_active, created_at=t.created_at, updated_at=t.updated_at
    ))


@router.get("/{template_id}", summary="获取模板详情", response_model=ResponseModel[TemplateDetailResponse])
async def get_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    t = await TemplateService.get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=TemplateDetailResponse(
        template_id=t.template_id, group_id=t.group_id, document_id=t.document_id,
        purpose=t.purpose, display_name=t.display_name, content=t.content,
        version=t.version, template_type=t.template_type, user_id=t.user_id,
        is_active=t.is_active, created_at=t.created_at, updated_at=t.updated_at
    ))


@router.get("", summary="获取模板列表", response_model=ResponseModel[TemplateListResponse])
async def list_templates(
    purpose: Optional[str] = None,
    template_type: Optional[int] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = None,
    include_user: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取模板列表。
    - 普通过滤：purpose / template_type / is_active / keyword
    - include_user=true：返回系统模板 + 当前用户个人模板库（忽略 template_type 参数）
    """
    if include_user:
        items, total = await TemplateService.list_templates_for_user(
            db, current_user.user_id, purpose, is_active, keyword, page, page_size
        )
    else:
        items, total = await TemplateService.list_templates(
            db, purpose, template_type, is_active, keyword, page, page_size
        )
    return success_response(data=TemplateListResponse(
        page=page, page_size=page_size, total=total,
        items=[_template_response(t) for t in items]
    ))


class TemplateUpdatePayload(BaseModel):
    purpose: Optional[str] = None
    display_name: Optional[str] = None
    content: Optional[TemplateContent] = None
    template_type: Optional[int] = None
    is_active: Optional[bool] = None


@router.put("/{template_id}", summary="管理员更新模板", response_model=ResponseModel[TemplateResponse])
async def update_template(
    template_id: UUID,
    data: TemplateUpdatePayload,
    editor=Depends(get_editor_user),
    db: AsyncSession = Depends(get_db)
):
    update_data = data.model_dump(exclude_none=True)
    if "content" in update_data:
        update_data["content"] = data.content.model_dump(exclude_none=True)
    t = await TemplateService.update_template(db, template_id, **update_data)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=_template_response(t))


@router.delete("/{template_id}", summary="删除模板")
async def delete_template(template_id: UUID, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    success = await TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(message="删除成功")


@router.put("/{template_id}/content", summary="用户更新模板", response_model=ResponseModel[TemplateResponse])
async def update_template_content(template_id: UUID, content: dict, editor=Depends(get_editor_user), db: AsyncSession = Depends(get_db)):
    t = await TemplateService.get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    if t.template_type == TemplateType.SYSTEM:
        raise HTTPException(status_code=403, detail="不能更新官方模板")
    t = await TemplateService.update_template_content(db, template_id, content)
    return success_response(data=_template_response(t))


@router.get("/purposes/list", summary="获取所有用途", response_model=ResponseModel[PurposeListResponse])
async def list_purposes(template_type: int = TemplateType.SYSTEM, db: AsyncSession = Depends(get_db)):
    purposes = await TemplateService.get_distinct_purposes(db, template_type)
    return success_response(data=PurposeListResponse(purposes=purposes))


@router.get("/by-purpose/{purpose}", summary="根据用途获取模板", response_model=ResponseModel[TemplateSimpleListResponse])
async def get_templates_by_purpose(
    purpose: str, template_type: Optional[int] = None,
    is_active: Optional[bool] = None, db: AsyncSession = Depends(get_db)
):
    templates = await TemplateService.get_templates_by_purpose(db, purpose, template_type, is_active)
    return success_response(data=TemplateSimpleListResponse(items=[_template_response(t) for t in templates]))


@router.post("/rollback/{template_id}", summary="回退官方模板", response_model=ResponseModel[TemplateResponse])
async def rollback_template(template_id: UUID, admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    t = await TemplateService.rollback_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data=_template_response(t))
