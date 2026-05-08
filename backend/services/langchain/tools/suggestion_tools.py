"""
建议工具

返回操作建议，不直接执行写入操作
"""

import logging
from typing import Any, Dict, List, Optional

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
import json

logger = logging.getLogger(__name__)


# ============================================================
# 写入工具（返回建议，不直接执行）
# ============================================================

class SuggestCreateParagraphInput(BaseModel):
    """建议创建段落输入"""
    chapter_id: str = Field(description="章节 ID")
    content: str = Field(description="段落内容")
    para_type: str = Field(default="paragraph", description="段落类型（paragraph/heading1/heading2/heading3）")
    description: str = Field(description="段落说明")


class SuggestCreateParagraphTool(BaseTool):
    """建议创建段落工具"""
    
    name: str = "suggest_create_paragraph"
    description: str = """
    建议创建新段落（需要用户手动应用）。
    
    输入：章节 ID、段落内容、段落类型、段落说明
    输出：[SUGGESTION] JSON 格式的建议
    
    示例：
    输入：{
        "chapter_id": "xxx",
        "content": "这是段落内容",
        "para_type": "paragraph",
        "description": "添加研究背景说明"
    }
    输出：
    [SUGGESTION]{"type": "create_paragraph", "chapter_id": "xxx", "para_type": "paragraph", "content": "...", "description": "..."}
    """
    args_schema: type[BaseModel] = SuggestCreateParagraphInput
    
    def _run(
        self,
        chapter_id: str,
        content: str,
        para_type: str = "paragraph",
        description: str = "",
    ) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(
        self,
        chapter_id: str,
        content: str,
        para_type: str = "paragraph",
        description: str = "",
    ) -> str:
        """
        异步运行
        
        Args:
            chapter_id: 章节 ID
            content: 段落内容
            para_type: 段落类型
            description: 段落说明
        
        Returns:
            [SUGGESTION] 格式的建议
        """
        suggestion = {
            "type": "create_paragraph",
            "chapter_id": chapter_id,
            "para_type": para_type,
            "content": content,
            "description": description,
        }
        
        result = f"[SUGGESTION]{json.dumps(suggestion, ensure_ascii=False)}"
        logger.info(f"建议创建段落: chapter_id={chapter_id} para_type={para_type}")
        return result


class SuggestEditContentInput(BaseModel):
    """建议修改内容输入"""
    target_type: str = Field(description="目标类型（paragraph/summary）")
    target_id: str = Field(description="目标 ID")
    original_content: str = Field(description="原内容")
    suggested_content: str = Field(description="修改后的内容")
    reason: str = Field(description="修改理由")


class SuggestEditContentTool(BaseTool):
    """建议修改内容工具"""
    
    name: str = "suggest_edit_content"
    description: str = """
    建议修改内容（需要用户手动应用）。
    
    输入：目标类型、目标 ID、原内容、修改后的内容、修改理由
    输出：[SUGGESTION] JSON 格式的建议
    
    示例：
    输入：{
        "target_type": "paragraph",
        "target_id": "xxx",
        "original_content": "原内容",
        "suggested_content": "修改后的内容",
        "reason": "增加数据支撑"
    }
    输出：
    [SUGGESTION]{"type": "edit_content", "target_type": "paragraph", "target_id": "xxx", ...}
    """
    args_schema: type[BaseModel] = SuggestEditContentInput
    
    def _run(
        self,
        target_type: str,
        target_id: str,
        original_content: str,
        suggested_content: str,
        reason: str,
    ) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(
        self,
        target_type: str,
        target_id: str,
        original_content: str,
        suggested_content: str,
        reason: str,
    ) -> str:
        """
        异步运行
        
        Args:
            target_type: 目标类型
            target_id: 目标 ID
            original_content: 原内容
            suggested_content: 修改后的内容
            reason: 修改理由
        
        Returns:
            [SUGGESTION] 格式的建议
        """
        suggestion = {
            "type": "edit_content",
            "target_type": target_type,
            "target_id": target_id,
            "original_content": original_content,
            "suggested_content": suggested_content,
            "reason": reason,
        }
        
        result = f"[SUGGESTION]{json.dumps(suggestion, ensure_ascii=False)}"
        logger.info(f"建议修改内容: target_type={target_type} target_id={target_id}")
        return result


class SuggestCreateChapterInput(BaseModel):
    """建议创建章节输入"""
    title: str = Field(description="章节标题")
    parent_id: Optional[str] = Field(default=None, description="父章节 ID（None 表示根章节）")
    description: str = Field(description="章节说明")


class SuggestCreateChapterTool(BaseTool):
    """建议创建章节工具"""
    
    name: str = "suggest_create_chapter"
    description: str = """
    建议创建新章节（需要用户手动应用）。
    
    输入：章节标题、父章节 ID、章节说明
    输出：[SUGGESTION] JSON 格式的建议
    
    示例：
    输入：{
        "title": "研究方法",
        "parent_id": null,
        "description": "添加研究方法章节"
    }
    输出：
    [SUGGESTION]{"type": "create_chapter", "title": "研究方法", "parent_id": null, "description": "..."}
    """
    args_schema: type[BaseModel] = SuggestCreateChapterInput
    
    def _run(
        self,
        title: str,
        parent_id: Optional[str] = None,
        description: str = "",
    ) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(
        self,
        title: str,
        parent_id: Optional[str] = None,
        description: str = "",
    ) -> str:
        """
        异步运行
        
        Args:
            title: 章节标题
            parent_id: 父章节 ID
            description: 章节说明
        
        Returns:
            [SUGGESTION] 格式的建议
        """
        suggestion = {
            "type": "create_chapter",
            "title": title,
            "parent_id": parent_id,
            "description": description,
        }
        
        result = f"[SUGGESTION]{json.dumps(suggestion, ensure_ascii=False)}"
        logger.info(f"建议创建章节: title={title} parent_id={parent_id}")
        return result


class SuggestInsertTextInput(BaseModel):
    """建议插入文本输入"""
    chapter_id: str = Field(description="章节 ID")
    content: str = Field(description="要插入的文本")
    position: str = Field(default="end", description="插入位置（start/end）")
    description: str = Field(description="插入说明")


class SuggestInsertTextTool(BaseTool):
    """建议插入文本工具"""
    
    name: str = "suggest_insert_text"
    description: str = """
    建议插入文本（需要用户手动应用）。
    
    输入：章节 ID、要插入的文本、插入位置、插入说明
    输出：[SUGGESTION] JSON 格式的建议
    
    示例：
    输入：{
        "chapter_id": "xxx",
        "content": "要插入的文本",
        "position": "end",
        "description": "补充结论"
    }
    输出：
    [SUGGESTION]{"type": "insert_text", "chapter_id": "xxx", "content": "...", "position": "end", "description": "..."}
    """
    args_schema: type[BaseModel] = SuggestInsertTextInput
    
    def _run(
        self,
        chapter_id: str,
        content: str,
        position: str = "end",
        description: str = "",
    ) -> str:
        """同步运行（不支持）"""
        raise NotImplementedError("请使用异步方法")
    
    async def _arun(
        self,
        chapter_id: str,
        content: str,
        position: str = "end",
        description: str = "",
    ) -> str:
        """
        异步运行
        
        Args:
            chapter_id: 章节 ID
            content: 要插入的文本
            position: 插入位置
            description: 插入说明
        
        Returns:
            [SUGGESTION] 格式的建议
        """
        suggestion = {
            "type": "insert_text",
            "chapter_id": chapter_id,
            "content": content,
            "position": position,
            "description": description,
        }
        
        result = f"[SUGGESTION]{json.dumps(suggestion, ensure_ascii=False)}"
        logger.info(f"建议插入文本: chapter_id={chapter_id} position={position}")
        return result


# ============================================================
# 工具创建函数
# ============================================================

def create_suggestion_tools() -> List[BaseTool]:
    """
    创建建议工具列表
    
    Returns:
        工具列表
    """
    return [
        SuggestCreateParagraphTool(),
        SuggestEditContentTool(),
        SuggestCreateChapterTool(),
        SuggestInsertTextTool(),
    ]
