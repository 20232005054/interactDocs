"""摘要相关响应 schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class SummaryResponse(BaseModel):
    summary_id: UUID
    document_id: UUID
    title: str
    field_key: str
    content: str
    is_change: int
    version: int
    order_index: int
    created_at: datetime
    updated_at: datetime


class SummaryWithAIResponse(SummaryResponse):
    ai_generate: Optional[str] = None


class SummaryListResponse(BaseModel):
    summaries: List[SummaryResponse]


class SummaryAIGenerateItem(BaseModel):
    """单条摘要 AI 生成结果，用于帮填和批量生成两个场景"""
    summary_id: UUID
    ai_generate: Optional[str] = None


# 向后兼容别名
SummaryAIAssistResponse = SummaryAIGenerateItem


class SummaryAIGenerateResponse(BaseModel):
    summaries: List[SummaryAIGenerateItem]


class RelatedSummaryItem(BaseModel):
    summary_id: UUID
    document_id: UUID
    title: str
    field_key: Optional[str] = None
    content: str
    version: int
    created_at: datetime
    updated_at: datetime
    relevance_score: float


class ParagraphRelatedSummariesResponse(BaseModel):
    summaries: List[RelatedSummaryItem]


class RelatedParagraphItem(BaseModel):
    paragraph_id: UUID
    chapter_id: UUID
    content: str
    para_type: str
    order_index: int
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    summary_version: Optional[int] = None
    relevance_score: float


class SummaryRelatedParagraphsResponse(BaseModel):
    paragraphs: List[RelatedParagraphItem]
