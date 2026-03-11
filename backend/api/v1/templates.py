from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.template_service import TemplateService
from db.models import SummaryTitleTemplate
from db.mappers.summary_title_template_mapper import SummaryTitleTemplateMapper

router = APIRouter(prefix="/api/v1/templates", tags=["模板管理"])

# 提示词模板管理

@router.post("/prompt", summary="创建提示词模板")
async def create_prompt_template(
    task_type: str,
    purpose: str,
    system_prompt: str,
    user_prompt_template: str,
    db: AsyncSession = Depends(get_db)
):
    """
    创建提示词模板
    """
    new_template = await TemplateService.create_prompt_template(
        db, task_type, purpose, system_prompt, user_prompt_template
    )
    return success_response(data={
        "template_id": new_template.template_id,
        "task_type": new_template.task_type,
        "purpose": new_template.purpose,
        "system_prompt": new_template.system_prompt,
        "user_prompt_template": new_template.user_prompt_template,
        "created_at": new_template.created_at,
        "updated_at": new_template.updated_at
    })

@router.get("/prompt/{template_id}", summary="获取提示词模板详情")
async def get_prompt_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    获取提示词模板详情
    """
    template = await TemplateService.get_prompt_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "task_type": template.task_type,
        "purpose": template.purpose,
        "system_prompt": template.system_prompt,
        "user_prompt_template": template.user_prompt_template,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.get("/prompt", summary="获取提示词模板列表")
async def list_prompt_templates(
    task_type: Optional[str] = None,
    purpose: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取提示词模板列表
    """
    templates = await TemplateService.list_prompt_templates(db, task_type, purpose)
    items = []
    for template in templates:
        items.append({
            "template_id": template.template_id,
            "task_type": template.task_type,
            "purpose": template.purpose,
            "system_prompt": template.system_prompt,
            "user_prompt_template": template.user_prompt_template,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        })
    return success_response(data={"items": items})

@router.put("/prompt/{template_id}", summary="更新提示词模板")
async def update_prompt_template(
    template_id: UUID,
    task_type: Optional[str] = None,
    purpose: Optional[str] = None,
    system_prompt: Optional[str] = None,
    user_prompt_template: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    更新提示词模板
    """
    update_data = {}
    if task_type:
        update_data["task_type"] = task_type
    if purpose:
        update_data["purpose"] = purpose
    if system_prompt:
        update_data["system_prompt"] = system_prompt
    if user_prompt_template:
        update_data["user_prompt_template"] = user_prompt_template
    
    template = await TemplateService.update_prompt_template(db, template_id, **update_data)
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "task_type": template.task_type,
        "purpose": template.purpose,
        "system_prompt": template.system_prompt,
        "user_prompt_template": template.user_prompt_template,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.delete("/prompt/{template_id}", summary="删除提示词模板")
async def delete_prompt_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    删除提示词模板
    """
    success = await TemplateService.delete_prompt_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    return success_response(message="删除成功")

# 文档结构模板管理

@router.post("/schema", summary="创建文档结构模板")
async def create_schema_template(
    purpose: str,
    schema_json: dict,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    创建文档结构模板
    """
    new_template = await TemplateService.create_schema_template(
        db, purpose, schema_json, description
    )
    return success_response(data={
        "template_id": new_template.template_id,
        "purpose": new_template.purpose,
        "schema_json": new_template.schema_json,
        "description": new_template.description,
        "created_at": new_template.created_at,
        "updated_at": new_template.updated_at
    })

@router.get("/schema/{template_id}", summary="获取文档结构模板详情")
async def get_schema_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    获取文档结构模板详情
    """
    template = await TemplateService.get_schema_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="文档结构模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "purpose": template.purpose,
        "schema_json": template.schema_json,
        "description": template.description,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.get("/schema", summary="获取文档结构模板列表")
async def list_schema_templates(
    purpose: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取文档结构模板列表
    """
    templates = await TemplateService.list_schema_templates(db, purpose)
    items = []
    for template in templates:
        items.append({
            "template_id": template.template_id,
            "purpose": template.purpose,
            "schema_json": template.schema_json,
            "description": template.description,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        })
    return success_response(data={"items": items})

@router.put("/schema/{template_id}", summary="更新文档结构模板")
async def update_schema_template(
    template_id: UUID,
    purpose: Optional[str] = None,
    schema_json: Optional[dict] = None,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    更新文档结构模板
    """
    update_data = {}
    if purpose:
        update_data["purpose"] = purpose
    if schema_json:
        update_data["schema_json"] = schema_json
    if description:
        update_data["description"] = description
    
    template = await TemplateService.update_schema_template(db, template_id, **update_data)
    if not template:
        raise HTTPException(status_code=404, detail="文档结构模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "purpose": template.purpose,
        "schema_json": template.schema_json,
        "description": template.description,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.delete("/schema/{template_id}", summary="删除文档结构模板")
async def delete_schema_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    删除文档结构模板
    """
    success = await TemplateService.delete_schema_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="文档结构模板不存在")
    return success_response(message="删除成功")

# 摘要标题模板管理

@router.post("/summary-titles", summary="创建摘要标题模板")
async def create_summary_title_template(
    purpose: str,
    title_templates: list,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    创建摘要标题模板
    """
    new_template = SummaryTitleTemplate(
        purpose=purpose,
        title_templates=title_templates,
        description=description
    )
    await SummaryTitleTemplateMapper.create_template(db, new_template)
    return success_response(data={
        "template_id": new_template.template_id,
        "purpose": new_template.purpose,
        "title_templates": new_template.title_templates,
        "description": new_template.description,
        "created_at": new_template.created_at,
        "updated_at": new_template.updated_at
    })

@router.get("/summary-titles/{template_id}", summary="获取摘要标题模板详情")
async def get_summary_title_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    获取摘要标题模板详情
    """
    template = await SummaryTitleTemplateMapper.get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="摘要标题模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "purpose": template.purpose,
        "title_templates": template.title_templates,
        "description": template.description,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.get("/summary-titles", summary="获取摘要标题模板列表")
async def list_summary_title_templates(
    purpose: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取摘要标题模板列表
    """
    if purpose:
        template = await SummaryTitleTemplateMapper.get_template_by_purpose(db, purpose)
        items = [template] if template else []
    else:
        items = await SummaryTitleTemplateMapper.get_all_templates(db)
    
    result = []
    for template in items:
        result.append({
            "template_id": template.template_id,
            "purpose": template.purpose,
            "title_templates": template.title_templates,
            "description": template.description,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        })
    return success_response(data={"items": result})

@router.put("/summary-titles/{template_id}", summary="更新摘要标题模板")
async def update_summary_title_template(
    template_id: UUID,
    purpose: Optional[str] = None,
    title_templates: Optional[list] = None,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    更新摘要标题模板
    """
    update_data = {}
    if purpose:
        update_data["purpose"] = purpose
    if title_templates:
        update_data["title_templates"] = title_templates
    if description:
        update_data["description"] = description
    
    template = await SummaryTitleTemplateMapper.update_template(db, template_id, update_data)
    if not template:
        raise HTTPException(status_code=404, detail="摘要标题模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "purpose": template.purpose,
        "title_templates": template.title_templates,
        "description": template.description,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.delete("/summary-titles/{template_id}", summary="删除摘要标题模板")
async def delete_summary_title_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    删除摘要标题模板
    """
    success = await SummaryTitleTemplateMapper.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="摘要标题模板不存在")
    return success_response(message="删除成功")
