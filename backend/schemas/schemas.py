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

# --- 元数据相关 ---
class FieldConfig(BaseModel):
    field: str
    label: str
    type: str
    required: bool
    options: Optional[List[str]] = None

class MetadataConfig(BaseModel):
    generateType: str
    title: str
    fields: List[FieldConfig]

# --- 文档相关 (Document) ---
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


# --- 全局变量相关 (GlobalVariable) ---
class GlobalVariable(BaseModel):
    """全局变量模型"""
    key: str = Field(..., description="变量名")
    value: str = Field(..., description="变量值")
    type: Optional[str] = Field(None, description="变量类型")
    description: Optional[str] = Field(None, description="变量描述")
    is_locked: Optional[bool] = Field(False, description="是否锁定")
    order_index: Optional[int] = Field(None, description="排序索引")


class GlobalVariablesUpdate(BaseModel):
    """更新全局变量请求模型"""
    variables: List[GlobalVariable] = Field(..., description="全局变量列表")


# --- 章节相关 (Chapter) ---
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
    order_index: Optional[int] = None
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


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[int] = None


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
    description: str

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
    content: str = Field(..., description="摘要内容")

class DocumentSummaryCreate(DocumentSummaryBase):
    document_id: UUID = Field(..., description="文档ID")
    order_index: Optional[int] = Field(None, description="排序索引")

class DocumentSummaryUpdate(BaseModel):
    title: Optional[str] = Field(None, description="摘要标题")
    content: Optional[str] = Field(None, description="摘要内容")


# --- 关键词相关 (DocumentKeyword) ---
class DocumentKeywordUpdate(BaseModel):
    keyword: str = Field(..., description="关键词")


# --- AI帮填请求相关 ---
class AIAssistRequest(BaseModel):
    summary_sections: Optional[List[str]] = Field(None, description="选择的摘要部分ID列表，不指定则使用所有摘要")
    keywords: Optional[List[str]] = Field(None, description="选择的关键词ID列表，不指定则使用所有关键词")


