"""模板系统相关响应 schema（主模板 + 三类子模板 + 应用结果 + 依赖关系）"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from schemas.template_schemas import SourceInfo, StructureTemplateParagraphDef
from schemas.response_schemas.chapter import ParagraphResponse


# ============================================================
# 主模板
# ============================================================

class TemplateResponse(BaseModel):
    template_id: UUID
    group_id: UUID
    purpose: str
    display_name: str
    content: dict
    version: int
    template_type: int
    user_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TemplateDetailResponse(TemplateResponse):
    document_id: Optional[UUID] = None


class TemplateListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: List[TemplateResponse]


class TemplateSimpleListResponse(BaseModel):
    """用于不分页的全量模板列表（如按用途查询）"""
    items: List[TemplateResponse]


class PurposeListResponse(BaseModel):
    purposes: List[str]


# ============================================================
# 核心信息模板
# ============================================================

class CoreInfoTemplateResponse(BaseModel):
    core_template_id: UUID
    template_id: UUID
    parent_id: Optional[UUID] = None
    field_name: str
    field_key: str
    field_type: str
    default_value: Optional[str] = None
    # options: select 类型的选项列表，如 ["选项A", "选项B"]
    options: Optional[List[str]] = None
    is_required: bool
    order_index: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    children: List['CoreInfoTemplateResponse'] = []


CoreInfoTemplateResponse.model_rebuild()


class CoreInfoTemplateListResponse(BaseModel):
    items: List[CoreInfoTemplateResponse]


# ============================================================
# 摘要模板
# ============================================================

class SummaryTemplateResponse(BaseModel):
    summary_template_id: UUID
    template_id: UUID
    title: str
    field_key: str
    generation_mode: int
    content_template: Optional[str] = None
    # sources: 来源配置数组，结构见 SourceInfo
    sources: Optional[List[SourceInfo]] = None
    default_prompt: Optional[str] = None
    custom_prompt: Optional[str] = None
    order_index: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SummaryTemplateListResponse(BaseModel):
    items: List[SummaryTemplateResponse]


# ============================================================
# 结构模板
# ============================================================

class StructureTemplateResponse(BaseModel):
    structure_template_id: UUID
    template_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: str
    level: int
    order_index: int
    # paragraphs: 段落定义数组，结构见 StructureTemplateParagraphDef
    paragraphs: Optional[List[StructureTemplateParagraphDef]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    children: List['StructureTemplateResponse'] = []


StructureTemplateResponse.model_rebuild()


class StructureTemplateListResponse(BaseModel):
    items: List[StructureTemplateResponse]


class StructureTemplateTreeResponse(BaseModel):
    tree: List[StructureTemplateResponse]


# ============================================================
# 模板应用结果
# ============================================================

class ApplyCoreInfoItem(BaseModel):
    core_info_id: str
    parent_id: Optional[str] = None
    title: str
    field_key: Optional[str] = None
    field_type: str
    content: str
    order_index: int
    is_locked: bool = False
    is_required: bool = True
    is_change: int = 0
    children: List['ApplyCoreInfoItem'] = []


ApplyCoreInfoItem.model_rebuild()


class ApplyCoreInfoResponse(BaseModel):
    message: str
    items: List[ApplyCoreInfoItem]


class ApplySummaryItem(BaseModel):
    summary_id: str
    title: str
    field_key: str
    content: str
    order_index: int
    generation_mode: int
    # sources: 来源配置数组，结构见 SourceInfo
    sources: Optional[List[SourceInfo]] = None
    degraded: bool
    generation_error: Optional[str] = None


class ApplySummaryResponse(BaseModel):
    message: str
    items: List[ApplySummaryItem]


class ApplyStructureItem(BaseModel):
    chapter_id: str
    parent_id: Optional[str] = None
    field_key: Optional[str] = None
    title: str
    order_index: int
    paragraph_count: int = 0
    # paragraphs: 已创建的段落列表
    paragraphs: Optional[List[ParagraphResponse]] = None
    degraded: bool
    generation_error: Optional[str] = None


class ApplyStructureResponse(BaseModel):
    message: str
    items: List[ApplyStructureItem]


# ============================================================
# 模板完整信息
# ============================================================

class TemplateInfoResponse(BaseModel):
    template_id: UUID
    core_info_templates: List[CoreInfoTemplateResponse]
    summary_templates: List[SummaryTemplateResponse]
    structure_templates: List[StructureTemplateResponse]


# ============================================================
# 模板依赖关系
# ============================================================

class TemplateDependencyRef(BaseModel):
    """单条引用/被引用关系"""
    type: str       # keyinfo / summary / structure
    field_key: str
    label: str      # field_name 或 title


class CoreInfoDependencyItem(BaseModel):
    field_key: str
    field_name: str
    referenced_by: List[TemplateDependencyRef] = []


class SummaryDependencyItem(BaseModel):
    field_key: str
    title: str
    references: List[TemplateDependencyRef] = []
    referenced_by: List[TemplateDependencyRef] = []


class StructureDependencyItem(BaseModel):
    field_key: str
    title: str
    references: List[TemplateDependencyRef] = []


class TemplateDependenciesResponse(BaseModel):
    core_info_templates: List[CoreInfoDependencyItem]
    summary_templates: List[SummaryDependencyItem]
    structure_templates: List[StructureDependencyItem]


# ============================================================
# 模板导入结果
# ============================================================

class UnmatchedLiteratureItem(BaseModel):
    """导入时未能匹配到的文献条目"""
    literature_key: Optional[str] = None
    title: Optional[str] = None
    doi: Optional[str] = None


class TemplateImportResponse(BaseModel):
    """模板导入结果，包含模板详情和未匹配文献列表"""
    template: TemplateDetailResponse
    unmatched_literature: List[UnmatchedLiteratureItem] = []
    # unmatched_literature 非空时，表示这些文献在知识库中未找到匹配，需要手动上传并绑定
