"""
内容优化链

基于评估结果优化内容：
- 问题分析
- 优化策略
- 内容重写
- 质量复查
"""

import logging
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.chains.evaluation_chain import EvaluationResult

logger = logging.getLogger(__name__)


class ContentRefinementChain:
    """
    内容优化链
    
    基于评估结果和用户反馈优化内容
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", "你是一位资深的临床研究方案专家，擅长优化和完善文档内容。"),
            ("human", """请优化以下内容：

【原始内容】
{original_content}

【评估结果】
总体评分：{score}
{evaluation_text}

【发现的问题】
{issues}

【改进建议】
{suggestions}

{user_feedback}

【优化要求】
1. 针对发现的问题进行修改
2. 采纳改进建议
3. 保持专业、严谨的语言风格
4. 保留正确的文献引用
5. 直接输出优化后的内容，不要添加说明

请输出优化后的内容：
""")
        ])
    
    async def refine(
        self,
        original_content: str,
        evaluation: EvaluationResult,
        user_feedback: Optional[str] = None,
    ) -> str:
        """
        优化内容
        
        Args:
            original_content: 原始内容
            evaluation: 评估结果
            user_feedback: 用户反馈
        
        Returns:
            优化后的内容
        """
        # 格式化问题和建议
        issues_text = "\n".join(f"{i+1}. {issue}" for i, issue in enumerate(evaluation.issues))
        suggestions_text = "\n".join(f"{i+1}. {sug}" for i, sug in enumerate(evaluation.suggestions))
        
        # 用户反馈
        feedback_text = ""
        if user_feedback:
            feedback_text = f"\n【用户反馈】\n{user_feedback}\n"
        
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "original_content": original_content,
            "score": f"{evaluation.score:.2f}",
            "evaluation_text": evaluation.evaluation_text or "（无评估结论）",
            "issues": issues_text or "（无明显问题）",
            "suggestions": suggestions_text or "（无改进建议）",
            "user_feedback": feedback_text,
        })
        
        logger.info(
            f"内容优化: original_length={len(original_content)} "
            f"refined_length={len(result)} score={evaluation.score:.2f}"
        )
        
        return result
    
    async def refine_stream(
        self,
        original_content: str,
        evaluation: EvaluationResult,
        user_feedback: Optional[str] = None,
    ):
        """
        流式优化内容
        
        Args:
            original_content: 原始内容
            evaluation: 评估结果
            user_feedback: 用户反馈
        
        Yields:
            优化后的文本块
        """
        # 格式化问题和建议
        issues_text = "\n".join(f"{i+1}. {issue}" for i, issue in enumerate(evaluation.issues))
        suggestions_text = "\n".join(f"{i+1}. {sug}" for i, sug in enumerate(evaluation.suggestions))
        
        feedback_text = ""
        if user_feedback:
            feedback_text = f"\n【用户反馈】\n{user_feedback}\n"
        
        # 流式调用
        chain = self.prompt | self.llm
        
        async for chunk in chain.astream({
            "original_content": original_content,
            "score": f"{evaluation.score:.2f}",
            "evaluation_text": evaluation.evaluation_text or "（无评估结论）",
            "issues": issues_text or "（无明显问题）",
            "suggestions": suggestions_text or "（无改进建议）",
            "user_feedback": feedback_text,
        }):
            yield chunk
    
    async def iterative_refine(
        self,
        original_content: str,
        evaluation: EvaluationResult,
        max_iterations: int = 3,
        target_score: float = 0.8,
    ) -> str:
        """
        迭代优化（直到达到目标分数或最大迭代次数）
        
        Args:
            original_content: 原始内容
            evaluation: 初始评估结果
            max_iterations: 最大迭代次数
            target_score: 目标分数
        
        Returns:
            优化后的内容
        """
        current_content = original_content
        current_evaluation = evaluation
        
        for iteration in range(max_iterations):
            # 检查是否达到目标
            if current_evaluation.score >= target_score:
                logger.info(
                    f"迭代优化完成: iteration={iteration} "
                    f"score={current_evaluation.score:.2f}"
                )
                break
            
            # 优化内容
            refined_content = await self.refine(
                original_content=current_content,
                evaluation=current_evaluation,
            )
            
            # 重新评估
            from services.langchain.chains.evaluation_chain import create_evaluation_chain
            eval_chain = create_evaluation_chain()
            
            new_evaluation = await eval_chain.evaluate(
                content=refined_content,
                content_type="段落",
                title="优化内容",
            )
            
            logger.info(
                f"迭代优化: iteration={iteration+1} "
                f"score={current_evaluation.score:.2f} -> {new_evaluation.score:.2f}"
            )
            
            # 如果分数没有提升，停止迭代
            if new_evaluation.score <= current_evaluation.score:
                logger.info("分数未提升，停止迭代")
                break
            
            current_content = refined_content
            current_evaluation = new_evaluation
        
        return current_content


def create_refinement_chain() -> ContentRefinementChain:
    """创建内容优化链"""
    return ContentRefinementChain()
