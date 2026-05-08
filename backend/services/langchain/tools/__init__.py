"""
LangChain 工具集

提供文档操作、文献检索、建议生成等工具
"""

from typing import List

from langchain_core.tools import BaseTool

from services.langchain.tools.document_tools import create_readonly_tools
from services.langchain.tools.literature_tools import create_query_tools
from services.langchain.tools.suggestion_tools import create_suggestion_tools
from services.langchain.tools.tool_tracker import get_tracker, ToolCallTracker


def create_all_tools() -> List[BaseTool]:
    """
    创建所有工具
    
    Returns:
        工具列表
    """
    tools = []
    
    # 只读工具
    tools.extend(create_readonly_tools())
    
    # 查询工具
    tools.extend(create_query_tools())
    
    # 建议工具
    tools.extend(create_suggestion_tools())
    
    return tools


def create_readonly_only_tools() -> List[BaseTool]:
    """
    创建只读工具（安全模式）
    
    Returns:
        只读工具列表
    """
    return create_readonly_tools()


def create_query_only_tools() -> List[BaseTool]:
    """
    创建查询工具（包含只读）
    
    Returns:
        查询工具列表
    """
    tools = []
    tools.extend(create_readonly_tools())
    tools.extend(create_query_tools())
    return tools


__all__ = [
    "create_all_tools",
    "create_readonly_only_tools",
    "create_query_only_tools",
    "create_readonly_tools",
    "create_query_tools",
    "create_suggestion_tools",
    "get_tracker",
    "ToolCallTracker",
]
