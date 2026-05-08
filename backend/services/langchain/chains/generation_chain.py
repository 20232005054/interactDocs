"""
内容生成链

实现段落和摘要的生成：
- 上下文构建
- Prompt 构建
- LLM 生成
- 引用提取
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.session_adapter import DocumentContext
from core.ai_prompts import SYSTEM_PROMPT_ASSIST, SYSTEM_PROMPT_SUMMARY, LITERATURE_CITATION_RULES

logger = logging.getLogger(__name__)


class ParagraphGenerationChain:
    """
    段落生成链
    
    基于文档上下文和文献检索结果生成段落内容
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_ASSIST),
            ("human", """{context}

{literature_context}

{instruction}

请基于以上信息生成段落内容。要求：
1. 语言严谨、符合临床研究规范
2. 直接输出段落内容，不要使用 Markdown 格式
3. 如果引用文献，使用 [编号] 格式
""")
        ])
    
    async def generate(
        self,
        doc_context: DocumentContext,
        chapter_title: str,
        current_content: Optional[str] = None,
        literature_context: str = "",
        instruction: Optional[str] = None,
    ) -> Tuple[str, List[int]]:
        """
        生成段落内容
        
        Args:
            doc_context: 文档上下文
            chapter_title: 章节标题
            current_content: 当前内容
            literature_context: 文献上下文
            instruction: 用户指令
        
        Returns:
            (generated_content, citation_indices)
        """
        # 构建上下文
        context_parts = []
        
        # 文档信息
        if doc_context.document:
            context_parts.append(f"文档标题：{doc_context.document.title}")
            if doc_context.document.purpose:
                context_parts.append(f"文档用途：{doc_context.document.purpose}")
        
        # 核心信息
        if doc_context.core_info:
            core_info_text = self._format_core_info(doc_context.core_info)
            if core_info_text:
                context_parts.append(f"【文档核心信息】\n{core_info_text}")
        
        # 摘要
        if doc_context.summaries:
            summary_text = self._format_summaries(doc_context.summaries)
            if summary_text:
                context_parts.append(f"【文档摘要】\n{summary_text}")
        
        # 当前章节
        context_parts.append(f"【当前章节】\n章节标题：{chapter_title}")
        
        if current_content:
            context_parts.append(f"当前内容：{current_content}")
        
        context = "\n\n".join(context_parts)
        
        # 构建指令
        if instruction:
            instruction_text = f"【用户修改意见】\n{instruction}\n\n请根据以上修改意见，对内容进行修改完善。"
        else:
            instruction_text = "请基于以上信息，为该章节生成专业的正文内容。"
        
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "context": context,
            "literature_context": literature_context or "（无参考文献）",
            "instruction": instruction_text,
        })
        
        # 提取引用
        citation_indices = self._extract_citations(result)
        
        logger.info(
            f"生成段落: chapter={chapter_title} "
            f"length={len(result)} citations={len(citation_indices)}"
        )
        
        return result, citation_indices
    
    async def generate_stream(
        self,
        doc_context: DocumentContext,
        chapter_title: str,
        current_content: Optional[str] = None,
        literature_context: str = "",
        instruction: Optional[str] = None,
    ):
        """
        流式生成段落内容
        
        Args:
            doc_context: 文档上下文
            chapter_title: 章节标题
            current_content: 当前内容
            literature_context: 文献上下文
            instruction: 用户指令
        
        Yields:
            生成的文本块
        """
        # 构建上下文（同 generate）
        context_parts = []
        
        if doc_context.document:
            context_parts.append(f"文档标题：{doc_context.document.title}")
            if doc_context.document.purpose:
                context_parts.append(f"文档用途：{doc_context.document.purpose}")
        
        if doc_context.core_info:
            core_info_text = self._format_core_info(doc_context.core_info)
            if core_info_text:
                context_parts.append(f"【文档核心信息】\n{core_info_text}")
        
        if doc_context.summaries:
            summary_text = self._format_summaries(doc_context.summaries)
            if summary_text:
                context_parts.append(f"【文档摘要】\n{summary_text}")
        
        context_parts.append(f"【当前章节】\n章节标题：{chapter_title}")
        
        if current_content:
            context_parts.append(f"当前内容：{current_content}")
        
        context = "\n\n".join(context_parts)
        
        if instruction:
            instruction_text = f"【用户修改意见】\n{instruction}\n\n请根据以上修改意见，对内容进行修改完善。"
        else:
            instruction_text = "请基于以上信息，为该章节生成专业的正文内容。"
        
        # 流式调用
        chain = self.prompt | self.llm
        
        async for chunk in chain.astream({
            "context": context,
            "literature_context": literature_context or "（无参考文献）",
            "instruction": instruction_text,
        }):
            yield chunk
    
    def _format_core_info(self, core_info: List[Any]) -> str:
        """格式化核心信息"""
        lines = []
        for ci in core_info:
            if ci.content and ci.content.strip():
                lines.append(f"{ci.title}：{ci.content.strip()}")
        return "\n".join(lines)
    
    def _format_summaries(self, summaries: List[Any]) -> str:
        """格式化摘要"""
        lines = []
        for s in summaries:
            if s.content and s.content.strip():
                lines.append(f"{s.title}：{s.content.strip()}")
        return "\n".join(lines)
    
    def _extract_citations(self, text: str) -> List[int]:
        """
        提取引用编号
        
        Args:
            text: 生成的文本
        
        Returns:
            引用编号列表
        """
        # 匹配 [1], [2] 等格式
        pattern = r'\[(\d+)\]'
        matches = re.findall(pattern, text)
        indices = [int(m) for m in matches]
        return sorted(set(indices))


class SummaryGenerationChain:
    """
    摘要生成链
    
    基于文档上下文生成摘要内容
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_SUMMARY),
            ("human", """{context}

{literature_context}

摘要标题：{summary_title}

{current_content}

请基于以上信息生成摘要内容。要求：
1. 语言专业简洁
2. 直接输出摘要内容
3. 如果引用文献，使用 [编号] 格式
""")
        ])
    
    async def generate(
        self,
        doc_context: DocumentContext,
        summary_title: str,
        current_content: Optional[str] = None,
        literature_context: str = "",
    ) -> Tuple[str, List[int]]:
        """
        生成摘要内容
        
        Args:
            doc_context: 文档上下文
            summary_title: 摘要标题
            current_content: 当前内容
            literature_context: 文献上下文
        
        Returns:
            (generated_content, citation_indices)
        """
        # 构建上下文
        context_parts = []
        
        if doc_context.document:
            context_parts.append(f"文档标题：{doc_context.document.title}")
        
        if doc_context.core_info:
            core_info_text = self._format_core_info(doc_context.core_info)
            if core_info_text:
                context_parts.append(f"【文档核心信息】\n{core_info_text}")
        
        context = "\n\n".join(context_parts)
        
        current_text = f"当前摘要内容：{current_content}" if current_content else ""
        
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "context": context,
            "literature_context": literature_context or "（无参考文献）",
            "summary_title": summary_title,
            "current_content": current_text,
        })
        
        # 提取引用
        citation_indices = self._extract_citations(result)
        
        logger.info(
            f"生成摘要: title={summary_title} "
            f"length={len(result)} citations={len(citation_indices)}"
        )
        
        return result, citation_indices
    
    def _format_core_info(self, core_info: List[Any]) -> str:
        """格式化核心信息"""
        lines = []
        for ci in core_info:
            if ci.content and ci.content.strip():
                lines.append(f"{ci.title}：{ci.content.strip()}")
        return "\n".join(lines)
    
    def _extract_citations(self, text: str) -> List[int]:
        """提取引用编号"""
        pattern = r'\[(\d+)\]'
        matches = re.findall(pattern, text)
        indices = [int(m) for m in matches]
        return sorted(set(indices))


def create_paragraph_generation_chain() -> ParagraphGenerationChain:
    """创建段落生成链"""
    return ParagraphGenerationChain()


def create_summary_generation_chain() -> SummaryGenerationChain:
    """创建摘要生成链"""
    return SummaryGenerationChain()
