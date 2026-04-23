"""操作历史、依赖图谱、文献相关响应 schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class OperationHistoryItem(BaseModel):
    history_id: UUID
    chapter_id: Optional[UUID] = None
    document_id: UUID
    user_id: Optional[UUID] = None
    action: str
    content_before: Optional[str] = None
    content_after: Optional[str] = None
    created_at: datetime


class OperationHistoryListResponse(BaseModel):
    total: int
    items: List[OperationHistoryItem]


class DependencyEdgeItem(BaseModel):
    edge_id: UUID
    source_type: Optional[str] = None
    source_id: Optional[UUID] = None
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    relevance_score: float
    target_version: Optional[int] = None


class DependenciesResponse(BaseModel):
    upstream: List[DependencyEdgeItem]
    downstream: List[DependencyEdgeItem]


class LiteratureResponse(BaseModel):
    literature_id: UUID
    literature_key: str
    title: Optional[str] = None
    authors: Optional[str] = None
    journal: Optional[str] = None
    publish_date: Optional[datetime] = None
    doi: Optional[str] = None
    impact_factor: Optional[float] = None
    source_file: Optional[str] = None
    upload_status: str
    error_message: Optional[str] = None
    scope: str
    # scope: 'public'=公共文献, 'private'=用户私有文献
    user_id: Optional[UUID] = None
    created_at: datetime


class LiteratureListResponse(BaseModel):
    items: List[LiteratureResponse]
    total: int


# ============================================================
# 对话历史相关
# ============================================================

class ChatRecordItem(BaseModel):
    chat_id: UUID
    document_id: UUID
    chapter_id: Optional[UUID] = None
    role: str
    message: str
    response: Optional[str] = None
    mode: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ChatRecordItem]
