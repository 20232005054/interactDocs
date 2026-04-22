"""核心信息相关响应 schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class CoreInfoResponse(BaseModel):
    core_info_id: UUID
    document_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    field_key: Optional[str] = None
    content: str
    field_type: str
    # options: select 类型的选项列表，如 ["选项A", "选项B"]
    options: Optional[List[str]] = None
    is_required: bool
    order_index: int
    is_locked: bool
    is_change: int
    created_at: datetime
    updated_at: datetime
    children: List['CoreInfoResponse'] = []


CoreInfoResponse.model_rebuild()
