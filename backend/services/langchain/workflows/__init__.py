"""
LangChain 工作流系统

提供三种工作流：
1. ChapterCompletionWorkflow - 章节完善工作流
2. DocumentGenerationWorkflow - 文档生成工作流
3. ContentReviewWorkflow - 内容审核工作流
"""

from services.langchain.workflows.chapter_completion import (
    ChapterCompletionWorkflow,
    create_chapter_completion_workflow,
)
from services.langchain.workflows.document_generation import (
    DocumentGenerationWorkflow,
    create_document_generation_workflow,
)
from services.langchain.workflows.content_review import (
    ContentReviewWorkflow,
    create_content_review_workflow,
)


__all__ = [
    "ChapterCompletionWorkflow",
    "create_chapter_completion_workflow",
    "DocumentGenerationWorkflow",
    "create_document_generation_workflow",
    "ContentReviewWorkflow",
    "create_content_review_workflow",
]
