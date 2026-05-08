"""
模板渲染链

统一处理模板应用时的内容生成，支持 4 种 generation_mode：
- mode 0: 复制模式（变量替换）
- mode 1: AI 生成模式
- mode 2: 直接使用模式（不替换变量）
- mode 3: AI 修改模式（以 content_template 为草稿）
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.session_adapter import SessionAdapter
from core.ai_prompts import SYSTEM_PROMPT_TEMPLATE_RENDER, LITERATURE_CITATION_RULES

logger = logging.getLogger(__name__)


class TemplateRenderChain:
    """
    模板渲染链
    
    根据 generation_mode 决定内容生成方式：
    - 0: 变量替换
    - 1: AI 生成
    - 2: 直接使用
    - 3: AI 修改（草稿润色）
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_TEMPLATE_RENDER),
            ("human", """{title_context}

{base_prompt}

{draft_context}

{core_info_background}

{sources_text}

{literature_context}

请基于以上信息生成内容。要求：
1. 语言严谨、符合临床研究规范
2. 直接输出内容，不要使用 Markdown 格式
3. 如果引用文献，使用 [编号] 格式
""")
        ])
    
    async def render(
        self,
        generation_mode: int,
        title: str,
        content_template: Optional[str],
        sources: Optional[List[Dict]],
        prompt: Optional[str],
        variable_map: Dict[str, str],
        core_info_background: str = "",
        literature_context: str = "",
        draft: Optional[str] = None,
        template_id: Optional[str] = None,
        field_key: Optional[str] = None,
    ) -> Tuple[str, List[int]]:
        """
        渲染模板内容
        
        Args:
            generation_mode: 生成方式 (0/1/2/3)
            title: 标题（摘要标题或章节标题）
            content_template: 内容模板
            sources: 来源配置
            prompt: AI 提示词
            variable_map: 变量映射表
            core_info_background: 核心信息背景
            literature_context: 文献上下文
            draft: 草稿内容（mode=3 时使用）
            template_id: 模板 ID（用于日志）
            field_key: 字段 key（用于日志）
        
        Returns:
            (generated_content, citation_indices)
        """
        logger.info(
            f"[模板渲染] mode={generation_mode} title={title} "
            f"template_id={template_id} field_key={field_key}"
        )
        
        # Mode 0: 复制模式（变量替换）
        if generation_mode == 0:
            content = self._render_copy_mode(content_template, variable_map)
            logger.info(f"[模板渲染] mode=0 复制完成 length={len(content)}")
            return content, []
        
        # Mode 2: 直接使用（不替换变量）
        if generation_mode == 2:
            content = content_template or ""
            logger.info(f"[模板渲染] mode=2 直接使用 length={len(content)}")
            return content, []
        
        # Mode 1: AI 生成
        # Mode 3: AI 修改（草稿润色）
        if generation_mode in (1, 3):
            content, citations = await self._render_ai_mode(
                title=title,
                prompt=prompt,
                variable_map=variable_map,
                core_info_background=core_info_background,
                literature_context=literature_context,
                draft=draft if generation_mode == 3 else None,
                sources=sources,
                template_id=template_id,
                field_key=field_key,
            )
            logger.info(
                f"[模板渲染] mode={generation_mode} AI生成完成 "
                f"length={len(content)} citations={len(citations)}"
            )
            return content, citations
        
        # 未知模式
        logger.warning(f"[模板渲染] 未知 generation_mode={generation_mode}，返回空")
        return "", []
    
    def _render_copy_mode(
        self,
        content_template: Optional[str],
        variable_map: Dict[str, str],
    ) -> str:
        """
        复制模式：变量替换
        
        Args:
            content_template: 内容模板
            variable_map: 变量映射表
        
        Returns:
            替换后的内容
        """
        if not content_template:
            return ""
        
        # 正则替换 {{var}} 变量
        pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
        
        def replacer(match):
            key = match.group(1)
            return str(variable_map.get(key, ""))
        
        return pattern.sub(replacer, content_template)
    
    async def _render_ai_mode(
        self,
        title: str,
        prompt: Optional[str],
        variable_map: Dict[str, str],
        core_info_background: str,
        literature_context: str,
        draft: Optional[str],
        sources: Optional[List[Dict]],
        template_id: Optional[str],
        field_key: Optional[str],
    ) -> Tuple[str, List[int]]:
        """
        AI 生成模式
        
        Args:
            title: 标题
            prompt: AI 提示词
            variable_map: 变量映射表
            core_info_background: 核心信息背景
            literature_context: 文献上下文
            draft: 草稿内容（mode=3）
            sources: 来源配置
            template_id: 模板 ID
            field_key: 字段 key
        
        Returns:
            (generated_content, citation_indices)
        """
        # 构建标题上下文
        title_context = f"当前需要生成的摘要/内容模块名称为：【{title}】"
        
        # 构建基础 prompt（替换变量）
        base_prompt = self._render_copy_mode(prompt or "", variable_map)
        
        # 构建草稿上下文（mode=3）
        draft_context = ""
        if draft and draft.strip():
            draft_context = (
                f"\n\n【当前草稿内容】\n{draft.strip()}\n"
                "请在以上草稿基础上进行修改完善，使其更专业、更符合临床研究规范。"
            )
        
        # 构建 sources 文本
        sources_text = self._build_sources_text(sources, variable_map)
        
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "title_context": title_context,
            "base_prompt": base_prompt,
            "draft_context": draft_context,
            "core_info_background": core_info_background or "",
            "sources_text": sources_text,
            "literature_context": literature_context or "（无参考文献）",
        })
        
        # 提取引用
        citation_indices = self._extract_citations(result)
        
        return result, citation_indices
    
    def _build_sources_text(
        self,
        sources: Optional[List[Dict]],
        variable_map: Dict[str, str],
    ) -> str:
        """
        构建 sources 参考数据文本
        
        Args:
            sources: 来源配置
            variable_map: 变量映射表
        
        Returns:
            格式化的 sources 文本
        """
        if not sources:
            return ""
        
        sources_text = "\n\n请严格结合以下参考数据进行总结和生成：\n"
        has_data = False
        
        for source in sources:
            match_keys = source.get("match_keys") or []
            for mk in match_keys:
                mk_value = mk.get("value") if isinstance(mk, dict) else None
                mk_label = (mk.get("label") if isinstance(mk, dict) else None) or mk_value
                
                if not mk_value:
                    continue
                
                value = variable_map.get(mk_value)
                if value and str(value).strip():
                    sources_text += f"【{mk_label}】:\n{value}\n\n"
                    has_data = True
        
        return sources_text if has_data else ""
    
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


def create_template_render_chain() -> TemplateRenderChain:
    """创建模板渲染链"""
    return TemplateRenderChain()

