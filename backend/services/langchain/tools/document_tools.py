"""
文档操作工具

提供文档、章节、段落的读取和操作工具
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from services.langchain.core.session_adapter import DocumentContext

logger = logging.getLogger(__name__)


# ============================================================
# 只读工具（从预加载上下文读取）
# ============================================================

class GetCoreInfoInput(BaseModel):
    """获取核心信息输入"""
    context: Dict[str, Any] = Field(description="文档上下文")


class GetCoreInfoTool(BaseTool):
    """获取文档核心信息工具"""
    
    name: str = "get_core_info"
    description: str = """
    获取文档的核心信息（树形结构）。
    
    输入：文档上下文
    输出：格式化的核心信息文本
    
    示例：
    输入：{"context": {...}}
    输出：
    试验名称：XXX
    试验目的：
      主要目的：XXX
      次要目的：XXX
    """
    args_schema: type[BaseModel] = GetCoreInfoInput
    
    def _run(self, context: Dict[str, Any]) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(self, context: Dict[str, Any]) -> str:
        """
        异步运行
        
        Args:
            context: 文档上下文
        
        Returns:
            格式化的核心信息
        """
        core_info = context.get("core_info", [])
        
        if not core_info:
            return "（无核心信息）"
        
        # 构建树形结构
        lines = []
        
        def build_tree(parent_id: Optional[str], indent: int = 0):
            """递归构建树"""
            children = [ci for ci in core_info if ci.get("parent_id") == parent_id]
            
            for ci in children:
                prefix = "  " * indent
                title = ci.get("title", "")
                content = ci.get("content", "")
                field_type = ci.get("field_type", "text")
                
                if field_type == "group":
                    # 分组节点
                    lines.append(f"{prefix}{title}：")
                    build_tree(ci.get("core_info_id"), indent + 1)
                else:
                    # 叶子节点
                    if content:
                        lines.append(f"{prefix}{title}：{content}")
        
        build_tree(None)
        
        result = "\n".join(lines)
        logger.info(f"获取核心信息: lines={len(lines)}")
        return result


class GetSummariesInput(BaseModel):
    """获取摘要输入"""
    context: Dict[str, Any] = Field(description="文档上下文")


class GetSummariesTool(BaseTool):
    """获取文档摘要工具"""
    
    name: str = "get_summaries"
    description: str = """
    获取文档的摘要列表。
    
    输入：文档上下文
    输出：格式化的摘要文本
    
    示例：
    输入：{"context": {...}}
    输出：
    研究背景：XXX
    研究目的：XXX
    研究方法：XXX
    """
    args_schema: type[BaseModel] = GetSummariesInput
    
    def _run(self, context: Dict[str, Any]) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(self, context: Dict[str, Any]) -> str:
        """
        异步运行
        
        Args:
            context: 文档上下文
        
        Returns:
            格式化的摘要
        """
        summaries = context.get("summaries", [])
        
        if not summaries:
            return "（无摘要）"
        
        lines = []
        for s in summaries:
            title = s.get("title", "")
            content = s.get("content", "")
            if content:
                lines.append(f"{title}：{content}")
        
        result = "\n".join(lines)
        logger.info(f"获取摘要: count={len(summaries)}")
        return result


class GetChapterContentInput(BaseModel):
    """获取章节内容输入"""
    context: Dict[str, Any] = Field(description="文档上下文")
    chapter_id: str = Field(description="章节 ID")


class GetChapterContentTool(BaseTool):
    """获取章节内容工具"""
    
    name: str = "get_chapter_content"
    description: str = """
    获取指定章节的完整内容（所有段落）。
    
    输入：文档上下文、章节 ID
    输出：章节标题和内容
    
    示例：
    输入：{"context": {...}, "chapter_id": "xxx"}
    输出：
    【章节标题】研究背景
    【章节内容】
    段落1内容...
    段落2内容...
    """
    args_schema: type[BaseModel] = GetChapterContentInput
    
    def _run(self, context: Dict[str, Any], chapter_id: str) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(self, context: Dict[str, Any], chapter_id: str) -> str:
        """
        异步运行
        
        Args:
            context: 文档上下文
            chapter_id: 章节 ID
        
        Returns:
            章节内容
        """
        chapters = context.get("chapters", [])
        
        # 查找章节
        chapter = None
        for c in chapters:
            if c.get("chapter_id") == chapter_id:
                chapter = c
                break
        
        if not chapter:
            return f"（章节不存在：{chapter_id}）"
        
        title = chapter.get("title", "")
        
        # 获取段落（从 chapter_context 中）
        chapter_context = context.get("chapter_context", {})
        paragraphs = chapter_context.get("paragraphs", [])
        
        if not paragraphs:
            return f"【章节标题】{title}\n【章节内容】（无内容）"
        
        # 拼接段落
        content_lines = []
        for p in paragraphs:
            content = p.get("content", "")
            if content:
                content_lines.append(content)
        
        content = "\n\n".join(content_lines)
        
        result = f"【章节标题】{title}\n【章节内容】\n{content}"
        logger.info(f"获取章节内容: chapter_id={chapter_id} paragraphs={len(paragraphs)}")
        return result


# ============================================================
# 工具创建函数
# ============================================================

def create_readonly_tools() -> List[BaseTool]:
    """
    创建只读工具列表
    
    Returns:
        工具列表
    """
    return [
        GetCoreInfoTool(),
        GetSummariesTool(),
        GetChapterContentTool(),
    ]
