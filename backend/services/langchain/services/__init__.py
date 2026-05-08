"""
LangChain 服务层 v2

使用 LangChain 框架重新实现的服务层，提供与原服务相同的接口
"""

from services.langchain.services.ai_service_v2 import AIServiceV2
from services.langchain.services.ai_chat_service_v2 import AIChatServiceV2
from services.langchain.services.literature_rag_service_v2 import LiteratureRagServiceV2
from services.langchain.services.template_apply_service_v2 import TemplateApplyServiceV2


__all__ = [
    "AIServiceV2",
    "AIChatServiceV2",
    "LiteratureRagServiceV2",
    "TemplateApplyServiceV2",
]
