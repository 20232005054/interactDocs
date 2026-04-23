"""模板系统相关 schema（主模板 + 三类子模板）"""
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID


# ============================================================
# 通用子结构
# ============================================================

class UISelectOption(BaseModel):
    value: str = Field(..., description="选项值")
    label: str = Field(..., description="显示名称")


class SourceInfo(BaseModel):
    source: UISelectOption = Field(..., description="来源类型对象")
    match_type: str = Field(..., description="匹配方式描述")
    match_keys: List[UISelectOption] = Field(..., description="具体匹配的标识列表")


# ============================================================
# 主模板
# ============================================================

class TemplateContent(BaseModel):
    description: Optional[str] = Field(None, description="模板说明文字")


class TemplateCreatePayload(BaseModel):
    purpose: str = Field(..., description="模板用途")
    display_name: str = Field(..., description="模板显示名称")
    content: Optional[TemplateContent] = Field(None, description="模板内容配置")
    template_type: int = Field(default=1, description="模板类型：0=文档私有副本 1=系统模板 2=用户可复用私有模板")
    user_id: Optional[UUID] = Field(None, description="所属用户ID")


class TemplateUpdatePayload(BaseModel):
    purpose: Optional[str] = Field(None, description="模板用途")
    display_name: Optional[str] = Field(None, description="模板显示名称")
    content: Optional[TemplateContent] = Field(None, description="模板内容配置")
    template_type: Optional[int] = Field(None, description="模板类型")
    is_active: Optional[bool] = Field(None, description="是否启用")


# ============================================================
# 核心信息模板
# ============================================================

class CoreInfoTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    field_name: str = Field(..., description="字段名称")
    field_type: str = Field(default="text", description="字段类型")
    default_value: Optional[str] = Field(None, description="默认值")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: bool = Field(default=True, description="是否必填")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到同级末尾")
    children: Optional[List['CoreInfoTemplateCreate']] = Field(default=[], description="子节点列表")


class CoreInfoTemplateInsertAfter(BaseModel):
    after_id: UUID = Field(..., description="在此节点之后插入")
    field_name: str = Field(..., description="字段名称")
    field_type: str = Field(default="text", description="字段类型")
    default_value: Optional[str] = Field(None, description="默认值")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: bool = Field(default=True, description="是否必填")


class CoreInfoTemplateReorder(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="同级父节点ID，根节点传 null")
    ordered_ids: List[UUID] = Field(..., description="同级节点按新顺序排列的 ID 列表")


class CoreInfoTemplateUpdate(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    field_name: Optional[str] = Field(None, description="字段名称")
    field_key: Optional[str] = Field(None, description="字段标识")
    field_type: Optional[str] = Field(None, description="字段类型")
    default_value: Optional[str] = Field(None, description="默认值")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: Optional[bool] = Field(None, description="是否必填")
    order_index: Optional[int] = Field(None, description="排序")
    children: Optional[List['CoreInfoTemplateUpdate']] = Field(default=[], description="子节点列表")


# ============================================================
# 摘要模板
# ============================================================

class SummaryTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    title: str = Field(..., description="摘要标题")
    generation_mode: int = Field(default=0, description="生成方式：0=复制 1=AI总结 2=直接使用 3=AI修改")
    content_template: Optional[str] = Field(None, description="内容模板，支持{{变量名}}替换")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到末尾")


class SummaryTemplateUpdate(BaseModel):
    title: Optional[str] = Field(None, description="摘要标题")
    field_key: Optional[str] = Field(None, description="字段标识")
    generation_mode: Optional[int] = Field(None, description="生成方式：0=复制 1=AI总结 2=直接使用 3=AI修改")
    content_template: Optional[str] = Field(None, description="内容模板")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序")


# ============================================================
# 结构模板
# ============================================================

class StructureTemplateParagraphDef(BaseModel):
    para_type: str = Field(default="paragraph", description="段落类型：paragraph/heading1/heading2/heading3")
    content_template: Optional[str] = Field(None, description="内容模板，mode=0/2/3 时使用，可含 {{变量}}")
    generation_mode: int = Field(default=2, description="生成方式：0=复制 1=AI生成 2=直接使用 3=AI修改")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源配置，mode=0/1/3 时使用")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="自定义AI提示词")


class StructureTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    parent_id: Optional[UUID] = Field(None, description="父章节ID")
    title: str = Field(..., description="章节标题")
    level: int = Field(..., description="层级")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到末尾")
    paragraphs: Optional[List[StructureTemplateParagraphDef]] = Field(None, description="段落定义数组")


class StructureTemplateUpdate(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="父章节ID")
    title: Optional[str] = Field(None, description="章节标题")
    field_key: Optional[str] = Field(None, description="字段标识")
    level: Optional[int] = Field(None, description="层级")
    order_index: Optional[int] = Field(None, description="排序")
    paragraphs: Optional[List[StructureTemplateParagraphDef]] = Field(None, description="段落定义数组")


# ============================================================
# 模板子项操作（insert-after / reorder）
# ============================================================

class SummaryTemplateInsertAfter(BaseModel):
    after_id: UUID = Field(..., description="在此节点之后插入")
    title: str = Field(..., description="摘要标题")
    generation_mode: int = Field(default=0, description="生成方式：0=复制 1=AI总结 2=直接使用 3=AI修改")
    content_template: Optional[str] = Field(None, description="内容模板")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")


class SummaryTemplateReorder(BaseModel):
    ordered_ids: List[UUID] = Field(..., description="摘要模板 ID 按新顺序排列的列表")


class StructureTemplateInsertAfter(BaseModel):
    after_id: UUID = Field(..., description="在此节点之后插入")
    title: str = Field(..., description="章节标题")
    level: int = Field(..., description="层级")
    paragraphs: Optional[List[StructureTemplateParagraphDef]] = Field(None, description="段落定义数组")


class StructureTemplateReorder(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="同级父节点ID，根节点传 null")
    ordered_ids: List[UUID] = Field(..., description="同级节点按新顺序排列的 ID 列表")


# ============================================================
# 文献
# ============================================================

class LiteratureUpdate(BaseModel):
    """更新文献元数据（用于 CrossRef 解析失败时手动补充）"""
    title: Optional[str] = Field(None, description="文献标题")
    authors: Optional[str] = Field(None, description="作者列表，逗号分隔")
    journal: Optional[str] = Field(None, description="期刊名称")
    doi: Optional[str] = Field(None, description="DOI")
    impact_factor: Optional[float] = Field(None, description="影响因子")
