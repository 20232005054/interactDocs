"""文档、快照相关响应 schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


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
    purpose: Optional[str] = None
    template_purpose: Optional[str] = None
    template_name: Optional[str] = None
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: List[DocumentListItem]


class SnapshotResponse(BaseModel):
    version_id: UUID
    document_id: UUID
    description: str
    snapshot_data: dict
    created_at: datetime
    created_by: Optional[UUID] = None


class SnapshotListResponse(BaseModel):
    snapshots: List[SnapshotResponse]


class ParagraphLiteratureItem(BaseModel):
    """段落文献绑定关系项"""
    paragraph_id: str
    chapter_id: str
    chapter_title: str
    paragraph_content: str
    paragraph_order: int
    literature_id: str
    literature_title: Optional[str] = None
    literature_authors: Optional[str] = None
    literature_journal: Optional[str] = None
    literature_doi: Optional[str] = None


class ParagraphLiteratureResponse(BaseModel):
    """文档段落文献绑定关系响应"""
    items: List[ParagraphLiteratureItem]
    total: int
