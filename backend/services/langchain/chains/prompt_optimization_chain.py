"""
Prompt 优化链

根据用户反馈优化 AI 提示词
"""

import logging
from typing import Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from services.langchain.core.llm_factory import get_qwen_llm

logger = logging.getLogger(__name__)


class PromptOptimizationChain:
    """
    Prompt 优化链
    
    根据用户对 AI 生成结果的反馈，优化提示词
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", "你是一位专业的 prompt 工程师，擅长根据用户反馈优化 AI 提示词。"),
            ("human", """现有提示词：
{current_prompt}

用户对生成结果的反馈：
{user_feedback}

请根据以上反馈，对提示词进行优化改写，使其能更好地指导 AI 生成符合用户期望的内容。

要求：
1. 直接输出优化后的提示词，不要解释
2. 保持提示词的专业性和清晰度
3. 融入用户反馈的要点
4. 不要改变提示词的基本结构和目标
""")
        ])
    
    async def optimize(
        self,
        current_prompt: str,
        user_feedback: str,
    ) -> str:
        """
        优化提示词
        
        Args:
            current_prompt: 当前提示词
            user_feedback: 用户反馈
        
        Returns:
            优化后的提示词
        """
        if not user_feedback or not user_feedback.strip():
            logger.warning("[Prompt优化] 用户反馈为空，返回原提示词")
            return current_prompt
        
        logger.info(
            f"[Prompt优化] 开始优化 "
            f"current_length={len(current_prompt)} "
            f"feedback_length={len(user_feedback)}"
        )
        
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "current_prompt": current_prompt or "（无现有提示词）",
            "user_feedback": user_feedback.strip(),
        })
        
        optimized = result.strip()
        
        logger.info(
            f"[Prompt优化] 完成 "
            f"original_length={len(current_prompt)} "
            f"optimized_length={len(optimized)}"
        )
        
        return optimized


def create_prompt_optimization_chain() -> PromptOptimizationChain:
    """创建 Prompt 优化链"""
    return PromptOptimizationChain()

