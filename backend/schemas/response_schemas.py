from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# ============================================================
# 文档相关
# ============================================================

class DocumentResponse(BaseModel):
    document_id: UUID
    title: str
    purpose: Optional[str] = None
    template_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentResponse):
    template_name: Optional[str] = None


class DocumentListItem(BaseModel):
    document_id: UUID
    title: str
    template_purpose: Optional[str] = None
    template_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: List[DocumentListItem]


# ============================================================
# 快照相关
# ============================================================

class SnapshotResponse(BaseModel):
    version_id: UUID
    document_id: UUID
    description: str
    snapshot_data: dict
    created_at: datetime
    created_by: Optional[UUID] = None


class SnapshotListResponse(BaseModel):
    snapshots: List[SnapshotResponse]


# ============================================================
# 章节相关
# ============================================================

class ParagraphInChapter(BaseModel):
    paragraph_id: UUID
    chapter_id: UUID
    content: str
    para_type: str
    order_index: int
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ischange: int


class ChapterResponse(BaseModel):
    chapter_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    status: int
    order_index: int
    updated_at: datetime
    paragraphs: Optional[List[ParagraphInChapter]] = None


class ChapterTreeNode(BaseModel):
    chapter_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    status: int
    order_index: int
    updated_at: datetime
    children: List['ChapterTreeNode'] = []


ChapterTreeNode.model_rebuild()


class ChapterTreeResponse(BaseModel):
    tree: List[ChapterTreeNode]


class TocItem(BaseModel):
    id: str
    type: str
    content: str
    order_index: int


class ChapterTocResponse(BaseModel):
    toc: List[TocItem]


# ============================================================
# 段落相关
# ============================================================

class ParagraphResponse(BaseModel):
    paragraph_id: UUID
    chapter_id: UUID
    content: str
    para_type: str
    order_index: int
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ischange: int


class ParagraphListResponse(BaseModel):
    paragraphs: List[ParagraphResponse]


# ============================================================
# 摘要相关
# ============================================================

class SummaryResponse(BaseModel):
    summary_id: UUID
    document_id: UUID
    title: str
    field_key: str
    content: str
    version: int
    order_index: int
    created_at: datetime
    updated_at: datetime


class SummaryWithAIResponse(SummaryResponse):
    ai_generate: Optional[str] = None


class SummaryListResponse(BaseModel):
    summaries: List[SummaryResponse]


# ============================================================
# 核心信息相关
# ============================================================

class CoreInfoResponse(BaseModel):
    core_info_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: Optional[str] = None
    content: str
    field_type: str
    options: Optional[Any] = None
    is_required: bool
    order_index: int
    is_locked: bool
    is_change: int
    created_at: datetime
    updated_at: datetime
    children: List['CoreInfoResponse'] = []


CoreInfoResponse.model_rebuild()


# ============================================================
# 模板相关
# ============================================================

class TemplateResponse(BaseModel):
    template_id: UUID
    group_id: UUID
    purpose: str
    display_name: str
    content: dict
    version: int
    is_system: bool
    user_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TemplateDetailResponse(TemplateResponse):
    document_id: Optional[UUID] = None


class TemplateListResponse(BaseModel):
    items: List[TemplateResponse]


class PurposeListResponse(BaseModel):
    purposes: List[str]


# ============================================================
# 核心信息模板相关
# ============================================================

class CoreInfoTemplateResponse(BaseModel):
    core_template_id: UUID
    template_id: UUID
    parent_id: Optional[UUID] = None
    field_name: str
    field_key: str
    field_type: str
    default_value: Optional[str] = None
    options: Optional[Any] = None
    is_required: bool
    order_index: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    children: List['CoreInfoTemplateResponse'] = []


CoreInfoTemplateResponse.model_rebuild()


class CoreInfoTemplateListResponse(BaseModel):
    items: List[CoreInfoTemplateResponse]


# ============================================================
# 摘要模板相关
# ============================================================

class SummaryTemplateResponse(BaseModel):
    summary_template_id: UUID
    template_id: UUID
    title: str
    field_key: str
    generation_mode: int
    content_template: Optional[str] = None
    sources: Optional[Any] = None
    default_prompt: Optional[str] = None
    custom_prompt: Optional[str] = None
    order_index: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SummaryTemplateListResponse(BaseModel):
    items: List[SummaryTemplateResponse]


# ============================================================
# 结构模板相关
# ============================================================

class StructureTemplateResponse(BaseModel):
    structure_template_id: UUID
    template_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: str
    level: int
    generation_mode: int
    content_template: Optional[str] = None
    sources: Optional[Any] = None
    default_prompt: Optional[str] = None
    custom_prompt: Optional[str] = None
    order_index: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    children: List['StructureTemplateResponse'] = []


StructureTemplateResponse.model_rebuild()


class StructureTemplateListResponse(BaseModel):
    items: List[StructureTemplateResponse]


class StructureTemplateTreeResponse(BaseModel):
    tree: List[StructureTemplateResponse]


# ============================================================
# 模板应用相关
# ============================================================

class ApplyCoreInfoItem(BaseModel):
    core_info_id: str
    parent_id: Optional[str] = None
    title: str
    content: str
    order_index: int
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
    sources: Optional[Any] = None
    degraded: bool
    generation_error: Optional[Any] = None


class ApplySummaryResponse(BaseModel):
    message: str
    items: List[ApplySummaryItem]


class ApplyStructureItem(BaseModel):
    chapter_id: str
    title: str
    order_index: int
    generation_mode: int
    content_template: Optional[str] = None
    sources: Optional[Any] = None
    default_prompt: Optional[str] = None
    custom_prompt: Optional[str] = None
    degraded: bool
    generation_error: Optional[Any] = None
    paragraph_id: Optional[str] = None
    paragraph_content: Optional[str] = None


class ApplyStructureResponse(BaseModel):
    message: str
    items: List[ApplyStructureItem]
