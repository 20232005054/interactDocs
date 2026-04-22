"""文档、章节、段落、摘要、核心信息相关 schema"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from uuid import UUID


# ============================================================
# 文档
# ============================================================

class DocumentCreate(BaseModel):
    title: str = Field(..., max_length=80, description="方案标题")
    purpose: str = Field(..., description="使用目的")
    template_id: UUID = Field(..., description="模板ID")


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=80, description="方案标题")
    purpose: Optional[str] = Field(None, description="使用目的")
    template_id: Optional[UUID] = Field(None, description="模板ID")


class SnapshotUpdate(BaseModel):
    description: str = Field(..., description="快照描述")


class PaginationParams(BaseModel):
    """通用分页查询参数"""
    page: int = Field(1, ge=1, description="页码，从 1 开始")
    page_size: int = Field(10, ge=1, le=100, description="每页数量")


class ExportTemplatePayload(BaseModel):
    display_name: Optional[str] = Field(None, description="自定义模板名称，不传则沿用原名")


# ============================================================
# 章节
# ============================================================

class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[int] = None
    parent_id: Optional[UUID] = Field(None, description="父章节ID")


# ============================================================
# 段落
# ============================================================

class ParagraphCreate(BaseModel):
    content: str = Field(..., description="文本内容")
    para_type: Optional[str] = None
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ischange: Optional[int] = None


class ParagraphUpdate(BaseModel):
    content: Optional[str] = None
    para_type: Optional[str] = None
    order_index: Optional[int] = None
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ai_instruction: Optional[str] = None
    ischange: Optional[int] = None


class AIAssistRequest(BaseModel):
    """段落 AI 帮填请求：instruction 有值时 AI 按意见修改，否则自动生成"""
    instruction: Optional[str] = Field(None, description="用户修改意见")


# ============================================================
# 摘要
# ============================================================

class DocumentSummaryUpdate(BaseModel):
    title: Optional[str] = Field(None, description="摘要标题")
    field_key: Optional[str] = Field(None, description="摘要标识")
    content: Optional[str] = Field(None, description="摘要内容")


# ============================================================
# 核心信息
# ============================================================

class CoreInfoCreate(BaseModel):
    title: str = Field(..., description="核心信息标题")
    content: str = Field(..., description="核心信息内容")
    field_type: str = Field(default="text", description="字段类型")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: bool = Field(default=True, description="是否必填")
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    order_index: Optional[int] = Field(None, description="排序索引")
    is_locked: Optional[bool] = Field(False, description="是否锁定")
    children: Optional[List['CoreInfoCreate']] = Field(default=[], description="子节点列表")


class CoreInfoUpdate(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    title: Optional[str] = Field(None, description="核心信息标题")
    content: Optional[str] = Field(None, description="核心信息内容")
    is_locked: Optional[bool] = Field(None, description="是否锁定")
    is_change: Optional[int] = Field(None, description="变更标记")
    children: Optional[List['CoreInfoUpdate']] = Field(default=[], description="子节点列表")


class CoreInfoOrderUpdate(BaseModel):
    new_order: int = Field(..., description="新的排序索引")


# ============================================================
# AI 对话
# ============================================================

class AIChatRequest(BaseModel):
    message: str = Field(..., description="用户发送的消息")
    document_id: UUID = Field(..., description="所属文档 ID")
    current_chapter_id: Optional[UUID] = None
    selected_paragraphs: Optional[List[Dict]] = Field(None, description="选中的段落信息列表")
    selected_summaries: Optional[List[Dict]] = Field(None, description="选中的摘要信息列表")


# ============================================================
# 重排相关
# ============================================================

class SummaryReorderPayload(BaseModel):
    ordered_ids: List[UUID] = Field(..., description="摘要 ID 按新顺序排列的列表")
