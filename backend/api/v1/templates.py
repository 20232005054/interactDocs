from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from core.response import success_response
from db.session import get_db
from services.template_service import TemplateService

router = APIRouter(prefix="/api/v1/templates", tags=["模板管理"])

# 模板管理通用接口

@router.post("", summary="创建模板")
async def create_template(
    purpose: str,
    display_name: str,
    content: dict,
    is_system: bool = False,
    user_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    创建模板
    """
    new_template = await TemplateService.create_template(
        db, purpose, display_name, content, is_system, user_id
    )
    return success_response(data={
        "template_id": new_template.template_id,
        "group_id": new_template.group_id,
        "purpose": new_template.purpose,
        "display_name": new_template.display_name,
        "content": new_template.content,
        "version": new_template.version,
        "is_system": new_template.is_system,
        "user_id": new_template.user_id,
        "is_active": new_template.is_active,
        "created_at": new_template.created_at,
        "updated_at": new_template.updated_at
    })

@router.get("/{template_id}", summary="获取模板详情")
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    获取模板详情
    """
    template = await TemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "group_id": template.group_id,

        "purpose": template.purpose,
        "display_name": template.display_name,
        "content": template.content,
        "version": template.version,
        "is_system": template.is_system,
        "user_id": template.user_id,
        "is_active": template.is_active,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

@router.get("", summary="获取模板列表")
async def list_templates(
    purpose: Optional[str] = None,
    is_system: Optional[bool] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取模板列表
    """
    templates = await TemplateService.list_templates(db, purpose, is_system, is_active)
    items = []
    for template in templates:
        items.append({
            "template_id": template.template_id,
            "group_id": template.group_id,
    
            "purpose": template.purpose,
            "display_name": template.display_name,
            "content": template.content,
            "version": template.version,
            "is_system": template.is_system,
            "user_id": template.user_id,
            "is_active": template.is_active,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        })
    return success_response(data={"items": items})

@router.put("/{template_id}", summary="管理员更新模板")
async def update_template(
    template_id: UUID,
    purpose: Optional[str] = None,
    display_name: Optional[str] = None,
    content: Optional[dict] = None,
    is_system: Optional[bool] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    管理员更新模板
    """
    update_data = {}
    if purpose:
        update_data["purpose"] = purpose
    if display_name:
        update_data["display_name"] = display_name
    if content:
        update_data["content"] = content
    if is_system is not None:
        update_data["is_system"] = is_system
    if is_active is not None:
        update_data["is_active"] = is_active
    
    template = await TemplateService.update_template(db, template_id, **update_data)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "group_id": template.group_id,

        "purpose": template.purpose,
        "display_name": template.display_name,
        "content": template.content,
        "version": template.version,
        "is_system": template.is_system,
        "user_id": template.user_id,
        "is_active": template.is_active,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })



@router.delete("/{template_id}", summary="删除模板")
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    删除模板
    """
    success = await TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(message="删除成功")

@router.put("/{template_id}/content", summary="用户更新模板")
async def update_template_content(
    template_id: UUID,
    content: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    用户更新模板（仅修改content字段，不更新版本）
    """
    # 先获取模板信息，检查是否为非官方模板
    template = await TemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    if template.is_system:
        raise HTTPException(status_code=403, detail="不能更新官方模板")
    
    # 更新模板内容
    template = await TemplateService.update_template_content(db, template_id, content)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data={
        "template_id": template.template_id,
        "group_id": template.group_id,
        "purpose": template.purpose,
        "display_name": template.display_name,
        "content": template.content,
        "version": template.version,
        "is_system": template.is_system,
        "user_id": template.user_id,
        "is_active": template.is_active,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    })

# 模板发现与克隆接口

@router.get("/purposes/list", summary="获取所有用途")
async def list_purposes(
    is_system: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有不同的用途
    """
    purposes = await TemplateService.get_distinct_purposes(db, is_system)
    return success_response(data={"purposes": purposes})

@router.get("/by-purpose/{purpose}", summary="根据用途获取模板")
async def get_templates_by_purpose(
    purpose: str,
    is_system: Optional[bool] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    根据用途获取模板列表
    """
    templates = await TemplateService.get_templates_by_purpose(db, purpose, is_system, is_active)
    items = []
    for template in templates:
        items.append({
            "template_id": template.template_id,
            "group_id": template.group_id,
    
            "purpose": template.purpose,
            "display_name": template.display_name,
            "content": template.content,
            "version": template.version,
            "is_system": template.is_system,
            "user_id": template.user_id,
            "is_active": template.is_active,
            "created_at": template.created_at,
            "updated_at": template.updated_at
        })
    return success_response(data={"items": items})

@router.post("/rollback/{template_id}", summary="回退官方模板")
async def rollback_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    回退官方模板（根据模板id查找对应的官方模板并回退内容）
    """
    rolled_back_template = await TemplateService.rollback_template(db, template_id)
    if not rolled_back_template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return success_response(data={
        "template_id": rolled_back_template.template_id,
        "group_id": rolled_back_template.group_id,
        "purpose": rolled_back_template.purpose,
        "display_name": rolled_back_template.display_name,
        "content": rolled_back_template.content,
        "version": rolled_back_template.version,
        "is_system": rolled_back_template.is_system,
        "user_id": rolled_back_template.user_id,
        "is_active": rolled_back_template.is_active,
        "created_at": rolled_back_template.created_at,
        "updated_at": rolled_back_template.updated_at
    })

