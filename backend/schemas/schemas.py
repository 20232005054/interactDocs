from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from typing import List, Optional, Dict

# --- 用户相关 (User) ---
class UserBase(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    name: str = Field(..., description="姓名")

class UserCreate(UserBase):
    password: str = Field(..., description="密码")

class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., description="密码")

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, description="姓名")

class User(UserBase):
    user_id: UUID
    role: str = Field(..., description="用户角色")

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(..., description="令牌类型")
    user_id: UUID = Field(..., description="用户 ID")



# --- 文档相关 (Document) ---------------------------------------------------------------------------------
class DocumentBase(BaseModel):
    title: str = Field(..., max_length=80, description="方案标题")
    purpose: str = Field(..., description="使用目的")
    template_id: UUID = Field(..., description="模板ID")

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=80, description="方案标题")
    purpose: Optional[str] = Field(None, description="使用目的")
    template_id: Optional[UUID] = Field(None, description="模板ID")


# --- 段落相关 (Paragraph) ---------------------------------------------------------------------------------
class ParagraphBase(BaseModel):
    content: str = Field(..., description="文本内容")
    para_type: str = Field(..., description="类型：正文、一级标题、二级标题、三级标题")
    order_index: int = Field(..., description="段落顺序")
    ai_eval: Optional[str] = Field(None, description="AI 评估")
    ai_suggestion: Optional[str] = Field(None, description="AI 修改建议")
    ai_generate: Optional[str] = Field(None, description="AI 帮填生成的内容")
    ischange: int = Field(0, description="关联摘要是否发生实质变更：0-否，1-是")

class ParagraphCreate(BaseModel):
    para_type: Optional[str] = None
    # order_index: Optional[int] = None
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ischange: Optional[int] = None
    content: str = Field(..., description="文本内容")

class ParagraphUpdate(BaseModel):
    content: Optional[str] = None
    para_type: Optional[str] = None
    order_index: Optional[int] = None
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ischange: Optional[int] = None

class ChapterBase(BaseModel):
    title: str = Field(..., description="章节标题")
    status: Optional[int] = Field(0, description="章节状态：0-编辑中，1-已完成")

class ChapterCreate(ChapterBase):
    document_id: UUID = Field(..., description="文档 ID")
    parent_id: Optional[UUID] = Field(None, description="父章节ID")

class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[int] = None
    parent_id: Optional[UUID] = Field(None, description="父章节ID")


# --- 文档版本相关 (DocumentVersion) ---
class DocumentVersionCreate(BaseModel):
    description: str = Field(..., description="版本描述")

class DocumentVersion(BaseModel):
    version_id: UUID
    document_id: UUID
    description: str
    snapshot_data: dict
    created_at: datetime
    created_by: UUID

    class Config:
        from_attributes = True

class DocumentVersionList(BaseModel):
    snapshots: List[DocumentVersion]

class SnapshotUpdate(BaseModel):
    description: str = Field(..., description="快照描述")

class PaginationParams(BaseModel):
    """通用分页查询参数"""
    page: int = Field(1, ge=1, description="页码，从 1 开始")
    page_size: int = Field(10, ge=1, le=100, description="每页数量")

# --- 操作历史相关 (OperationHistory) ---
class OperationHistory(BaseModel):
    history_id: UUID
    chapter_id: Optional[UUID] = None
    document_id: UUID
    user_id: UUID
    operation_type: str
    content_before: Optional[list] = None
    content_after: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OperationHistoryList(BaseModel):
    total: int
    items: List[OperationHistory]

class ChapterHistoryList(BaseModel):
    history: List[OperationHistory]

# --- AI 功能相关 ---
class AIAssistResponse(BaseModel):
    content: list = Field(..., description="生成的章节内容")
    message: str = Field(..., description="响应消息")

class AIEvaluateResponse(BaseModel):
    evaluation: str = Field(..., description="评估结果")
    suggestions: List[str] = Field(..., description="改进建议")

class AIChatRequest(BaseModel):
    message: str = Field(..., description="用户发送的消息")
    document_id: UUID = Field(..., description="所属文档 ID")
    current_chapter_id: Optional[UUID] = None
    selected_paragraphs: Optional[List[Dict]] = Field(None, description="选中的段落信息列表")
    selected_keywords: Optional[List[Dict]] = Field(None, description="选中的关键词信息列表")
    selected_summaries: Optional[List[Dict]] = Field(None, description="选中的摘要信息列表")

class AIChatResponse(BaseModel):
    response: str = Field(..., description="AI 回复内容")
    actions: List[Dict] = Field(default=[], description="AI 建议执行的操作，如更新某个章节")

class AIRevisionRequest(BaseModel):
    document_id: UUID = Field(..., description="文档 ID")
    chapter_id: UUID = Field(..., description="章节 ID")
    instruction: str = Field(..., description="修订指令")
    selected_paragraphs: Optional[List[Dict]] = Field(None, description="选中的段落信息列表")
    selected_keywords: Optional[List[Dict]] = Field(None, description="选中的关键词信息列表")
    selected_summaries: Optional[List[Dict]] = Field(None, description="选中的摘要信息列表")

class AIRevisionResponse(BaseModel):
    content: list = Field(..., description="修订后的内容")
    message: str = Field(..., description="响应消息")

# --- 辅助功能相关 ---
class TutorialResponse(BaseModel):
    content: str = Field(..., description="教程内容")

class GenerateSchemaResponse(BaseModel):
    message: str
    chapters: List[dict] # 包含 chapter_id, title, status


# --- 摘要相关 (DocumentSummary) ---
class DocumentSummaryBase(BaseModel):
    title: str = Field(..., description="摘要标题")
    field_key: str = Field(..., description="摘要标识")
    content: str = Field(..., description="摘要内容")

class DocumentSummaryCreate(DocumentSummaryBase):
    document_id: UUID = Field(..., description="文档ID")
    order_index: Optional[int] = Field(None, description="排序索引")

class DocumentSummaryUpdate(BaseModel):
    title: Optional[str] = Field(None, description="摘要标题")
    field_key: Optional[str] = Field(None, description="摘要标识")
    content: Optional[str] = Field(None, description="摘要内容")


# --- 关键词相关 (DocumentKeyword) ---
class DocumentKeywordUpdate(BaseModel):
    keyword: str = Field(..., description="关键词")


# --- 核心信息相关 (DocumentCoreInfo) ---
class CoreInfoBase(BaseModel):
    title: str = Field(..., description="核心信息标题")
    content: str = Field(..., description="核心信息内容")
    field_type: str = Field(default="text", description="字段类型")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: bool = Field(default=True, description="是否必填")

class CoreInfoCreate(CoreInfoBase):
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

class CoreInfo(CoreInfoBase):
    core_info_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    order_index: int
    is_locked: bool
    is_change: int
    created_at: datetime
    updated_at: datetime
    children: Optional[List['CoreInfo']] = Field(default=[], description="子节点列表")
    
    class Config:
        from_attributes = True


# --- AI帮填请求相关 ---
class AIAssistRequest(BaseModel):
    summary_sections: Optional[List[str]] = Field(None, description="选择的摘要部分ID列表，不指定则使用所有摘要")
    keywords: Optional[List[str]] = Field(None, description="选择的关键词ID列表，不指定则使用所有关键词")


# --- 核心信息模板相关 (CoreInfoTemplate) ---
class UISelectOption(BaseModel):
    value: str = Field(..., description="选项值")
    label: str = Field(..., description="显示名称")
    ui_type: Optional[str] = Field("select", description="UI组件类型")


class SourceInfo(BaseModel):
    source: UISelectOption = Field(..., description="来源类型对象")
    match_type: str = Field(..., description="匹配方式描述")
    match_keys: List[UISelectOption] = Field(..., description="具体匹配的标识列表")
    target_field: str = Field(..., description="目标字段名，对应content_template中的{{变量名}}")


class CoreInfoTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    parent_id: Optional[UUID] = Field(None, description="父节点ID")
    field_name: str = Field(..., description="字段名称")
    field_key: str = Field(..., description="字段标识")
    field_type: str = Field(default="text", description="字段类型")
    default_value: Optional[str] = Field(None, description="默认值")
    options: Optional[List[str]] = Field(None, description="select类型的选项列表")
    is_required: bool = Field(default=True, description="是否必填")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到同级末尾")
    children: Optional[List['CoreInfoTemplateCreate']] = Field(default=[], description="子节点列表")


class CoreInfoTemplateInsertAfter(BaseModel):
    after_id: UUID = Field(..., description="在此节点之后插入")
    field_name: str = Field(..., description="字段名称")
    field_key: str = Field(..., description="字段标识")
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


# --- 摘要模板相关 (SummaryTemplate) ---
class SummaryTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    title: str = Field(..., description="摘要标题")
    field_key: str = Field(..., description="字段标识")
    generation_mode: int = Field(default=0, description="生成方式：0=复制，1=AI总结")
    content_template: Optional[str] = Field(None, description="内容模板，支持{{变量名}}替换")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到末尾")


class SummaryTemplateUpdate(BaseModel):
    title: Optional[str] = Field(None, description="摘要标题")
    field_key: Optional[str] = Field(None, description="字段标识")
    generation_mode: Optional[int] = Field(None, description="生成方式：0=复制，1=AI总结")
    content_template: Optional[str] = Field(None, description="内容模板")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序")


# --- 文章结构模板相关 (StructureTemplate) ---
class StructureTemplateCreate(BaseModel):
    template_id: UUID = Field(..., description="关联的主模板ID")
    parent_id: Optional[UUID] = Field(None, description="父章节ID")
    title: str = Field(..., description="章节标题")
    field_key: str = Field(..., description="字段标识")
    level: int = Field(..., description="层级")
    generation_mode: int = Field(default=0, description="生成方式：0=复制，1=AI总结")
    content_template: Optional[str] = Field(None, description="内容模板")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序，不传则追加到末尾")


class StructureTemplateUpdate(BaseModel):
    parent_id: Optional[UUID] = Field(None, description="父章节ID")
    title: Optional[str] = Field(None, description="章节标题")
    field_key: Optional[str] = Field(None, description="字段标识")
    level: Optional[int] = Field(None, description="层级")
    generation_mode: Optional[int] = Field(None, description="生成方式：0=复制，1=AI总结")
    content_template: Optional[str] = Field(None, description="内容模板")
    sources: Optional[List[SourceInfo]] = Field(None, description="来源信息数组")
    default_prompt: Optional[str] = Field(None, description="默认AI提示词")
    custom_prompt: Optional[str] = Field(None, description="专属AI提示词")
    order_index: Optional[int] = Field(None, description="排序")


