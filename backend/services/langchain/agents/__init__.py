"""
LangChain 智能体系统

提供三种智能体：
1. DocumentChatAgent - 对话智能体
2. DocumentEditorAgent - 编辑智能体
3. ResearchAgent - 文献研究智能体
"""

from services.langchain.agents.chat_agent import (
    DocumentChatAgent,
    create_chat_agent,
)
from services.langchain.agents.editor_agent import (
    DocumentEditorAgent,
    create_editor_agent,
)
from services.langchain.agents.research_agent import (
    ResearchAgent,
    create_research_agent,
)


__all__ = [
    "DocumentChatAgent",
    "create_chat_agent",
    "DocumentEditorAgent",
    "create_editor_agent",
    "ResearchAgent",
    "create_research_agent",
]
