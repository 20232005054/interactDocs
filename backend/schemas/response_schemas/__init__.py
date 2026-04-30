"""
response_schemas 包

各业务域响应 schema 分文件存放：
  document.py   — 文档、快照
  chapter.py    — 段落、章节、全量内容
  summary.py    — 摘要、摘要 AI、关联查询
  core_info.py  — 核心信息
  template.py   — 模板主表 + 三类子模板 + 应用结果 + 依赖关系
  misc.py       — 操作历史、依赖图谱、文献

外部 import 路径不变：from schemas.response_schemas import XxxResponse
"""

from schemas.response_schemas.document import (
    DocumentResponse,
    DocumentDetailResponse,
    DocumentListItem,
    DocumentListResponse,
    SnapshotResponse,
    SnapshotListResponse,
    ParagraphLiteratureItem,
    ParagraphLiteratureResponse,
)

from schemas.response_schemas.chapter import (
    ParagraphResponse,
    ParagraphListResponse,
    ParagraphInChapter,
    FullContentParagraph,
    ChapterResponse,
    ChapterTreeNode,
    ChapterTreeResponse,
    TocItem,
    ChapterTocResponse,
    FullContentChapter,
    FullContentResponse,
)

from schemas.response_schemas.summary import (
    SummaryResponse,
    SummaryWithAIResponse,
    SummaryListResponse,
    SummaryAIGenerateItem,
    SummaryAIAssistResponse,
    SummaryAIGenerateResponse,
    RelatedSummaryItem,
    ParagraphRelatedSummariesResponse,
    RelatedParagraphItem,
    SummaryRelatedParagraphsResponse,
)

from schemas.response_schemas.core_info import (
    CoreInfoResponse,
)

from schemas.response_schemas.template import (
    TemplateResponse,
    TemplateDetailResponse,
    TemplateListResponse,
    TemplateSimpleListResponse,
    PurposeListResponse,
    CoreInfoTemplateResponse,
    CoreInfoTemplateListResponse,
    SummaryTemplateResponse,
    SummaryTemplateListResponse,
    StructureTemplateResponse,
    StructureTemplateListResponse,
    StructureTemplateTreeResponse,
    ApplyCoreInfoItem,
    ApplyCoreInfoResponse,
    ApplySummaryItem,
    ApplySummaryResponse,
    ApplyStructureItem,
    ApplyStructureResponse,
    TemplateInfoResponse,
    TemplateDependencyRef,
    CoreInfoDependencyItem,
    SummaryDependencyItem,
    StructureDependencyItem,
    TemplateDependenciesResponse,
    UnmatchedLiteratureItem,
    TemplateImportResponse,
)

from schemas.response_schemas.misc import (
    OperationHistoryItem,
    OperationHistoryListResponse,
    DependencyEdgeItem,
    DependenciesResponse,
    LiteratureResponse,
    LiteratureListResponse,
    DocumentCitationItem,
    DocumentCitationsResponse,
    ChatRecordItem,
    ChatHistoryResponse,
)

__all__ = [
    # document
    "DocumentResponse", "DocumentDetailResponse", "DocumentListItem", "DocumentListResponse",
    "SnapshotResponse", "SnapshotListResponse",
    "ParagraphLiteratureItem", "ParagraphLiteratureResponse",
    # chapter
    "ParagraphResponse", "ParagraphListResponse", "ParagraphInChapter", "FullContentParagraph",
    "ChapterResponse", "ChapterTreeNode", "ChapterTreeResponse", "TocItem", "ChapterTocResponse",
    "FullContentChapter", "FullContentResponse",
    # summary
    "SummaryResponse", "SummaryWithAIResponse", "SummaryListResponse",
    "SummaryAIGenerateItem", "SummaryAIAssistResponse", "SummaryAIGenerateResponse",
    "RelatedSummaryItem", "ParagraphRelatedSummariesResponse",
    "RelatedParagraphItem", "SummaryRelatedParagraphsResponse",
    # core_info
    "CoreInfoResponse",
    # template
    "TemplateResponse", "TemplateDetailResponse", "TemplateListResponse",
    "TemplateSimpleListResponse", "PurposeListResponse",
    "CoreInfoTemplateResponse", "CoreInfoTemplateListResponse",
    "SummaryTemplateResponse", "SummaryTemplateListResponse",
    "StructureTemplateResponse", "StructureTemplateListResponse", "StructureTemplateTreeResponse",
    "ApplyCoreInfoItem", "ApplyCoreInfoResponse",
    "ApplySummaryItem", "ApplySummaryResponse",
    "ApplyStructureItem", "ApplyStructureResponse",
    "TemplateInfoResponse",
    "TemplateDependencyRef", "CoreInfoDependencyItem", "SummaryDependencyItem",
    "StructureDependencyItem", "TemplateDependenciesResponse",
    "UnmatchedLiteratureItem", "TemplateImportResponse",
    # misc
    "OperationHistoryItem", "OperationHistoryListResponse",
    "DependencyEdgeItem", "DependenciesResponse",
    "LiteratureResponse", "LiteratureListResponse",
    "DocumentCitationItem", "DocumentCitationsResponse",
    "ChatRecordItem", "ChatHistoryResponse",
]
