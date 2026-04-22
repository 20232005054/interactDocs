"""段落、章节、全量内容相关响应 schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ============================================================
# 段落
# ============================================================

class ParagraphResponse(BaseModel):
    """段落完整响应（用于单独查询段落、嵌入章节、全量内容等场景）"""
    paragraph_id: UUID
    chapter_id: UUID
    content: str
    para_type: str
    order_index: int
    para_def_idx: Optional[int] = None
    ai_eval: Optional[str] = None
    ai_suggestion: Optional[str] = None
    ai_generate: Optional[str] = None
    ai_instruction: Optional[str] = None
    ischange: int


class ParagraphListResponse(BaseModel):
    paragraphs: List[ParagraphResponse]


# ParagraphInChapter / FullContentParagraph 已合并到 ParagraphResponse
ParagraphInChapter = ParagraphResponse
FullContentParagraph = ParagraphResponse


# ============================================================
# 章节
# ============================================================

class ChapterResponse(BaseModel):
    chapter_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: Optional[str] = None
    status: int
    order_index: int
    updated_at: datetime
    paragraphs: Optional[List[ParagraphResponse]] = None


class ChapterTreeNode(BaseModel):
    chapter_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: Optional[str] = None
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
# 全量内容
# ============================================================

class FullContentChapter(BaseModel):
    chapter_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: Optional[str] = None
    status: int
    order_index: int
    updated_at: datetime
    paragraphs: List[ParagraphResponse] = []
    children: List['FullContentChapter'] = []


FullContentChapter.model_rebuild()


class FullContentResponse(BaseModel):
    document_id: UUID
    tree: List[FullContentChapter]
