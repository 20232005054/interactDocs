"""
质量评估链

评估生成内容的质量：
- 完整性检查
- 准确性验证
- 风格一致性
- 引用验证
- 评分计算
"""

import logging
import re
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field

from services.langchain.core.llm_factory import get_qwen_llm
from core.ai_prompts import SYSTEM_PROMPT_EVALUATE

logger = logging.getLogger(__name__)


class EvaluationResult(BaseModel):
    """评估结果"""
    score: float = Field(description="总体评分 (0-1)")
    completeness: float = Field(description="完整性评分 (0-1)")
    accuracy: float = Field(description="准确性评分 (0-1)")
    style: float = Field(description="风格一致性评分 (0-1)")
    citation: float = Field(description="引用规范性评分 (0-1)")
    issues: List[str] = Field(default_factory=list, description="发现的问题")
    suggestions: List[str] = Field(default_factory=list, description="改进建议")
    evaluation_text: str = Field(default="", description="评估文本")


class QualityEvaluationChain:
    """
    质量评估链
    
    评估生成内容的质量并给出改进建议
    """
    
    def __init__(self):
        self.llm = get_qwen_llm()
        self.prompt = self._create_prompt()
    
    def _create_prompt(self) -> ChatPromptTemplate:
        """创建 Prompt 模板"""
        return ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_EVALUATE),
            ("human", """请对以下内容进行专业评估：

【文档背景】
{context}

【待评估内容】
类型：{content_type}
标题：{title}
内容：
{content}

【评估要求】
请从以下维度进行评估，并给出 0-1 的分数：
1. 完整性：内容是否完整，是否涵盖了必要的信息
2. 准确性：内容是否准确，是否符合专业规范
3. 风格一致性：语言风格是否专业、严谨、一致
4. 引用规范性：文献引用是否规范、准确

请按以下格式输出：

【评估结论】
（总体评价，2-3 句话）

【评分】
完整性：0.XX
准确性：0.XX
风格一致性：0.XX
引用规范性：0.XX
总体评分：0.XX

【发现的问题】
1. 问题1
2. 问题2
...

【改进建议】
1. 建议1
2. 建议2
3. 建议3
...
""")
        ])
    
    async def evaluate(
        self,
        content: str,
        content_type: str,
        title: str,
        context: str = "",
    ) -> EvaluationResult:
        """
        评估内容质量
        
        Args:
            content: 待评估内容
            content_type: 内容类型（段落/摘要）
            title: 标题
            context: 文档背景
        
        Returns:
            EvaluationResult
        """
        # 调用 LLM
        chain = self.prompt | self.llm | StrOutputParser()
        
        result = await chain.ainvoke({
            "context": context or "（无背景信息）",
            "content_type": content_type,
            "title": title,
            "content": content,
        })
        
        # 解析结果
        evaluation = self._parse_evaluation(result)
        
        logger.info(
            f"质量评估: type={content_type} title={title} "
            f"score={evaluation.score:.2f}"
        )
        
        return evaluation
    
    def _parse_evaluation(self, result: str) -> EvaluationResult:
        """
        解析评估结果
        
        Args:
            result: LLM 输出
        
        Returns:
            EvaluationResult
        """
        # 提取评分
        scores = {
            "completeness": 0.7,
            "accuracy": 0.7,
            "style": 0.7,
            "citation": 0.7,
            "score": 0.7,
        }
        
        # 匹配评分
        score_patterns = {
            "completeness": r'完整性[：:]\s*([0-9.]+)',
            "accuracy": r'准确性[：:]\s*([0-9.]+)',
            "style": r'风格一致性[：:]\s*([0-9.]+)',
            "citation": r'引用规范性[：:]\s*([0-9.]+)',
            "score": r'总体评分[：:]\s*([0-9.]+)',
        }
        
        for key, pattern in score_patterns.items():
            match = re.search(pattern, result)
            if match:
                try:
                    scores[key] = float(match.group(1))
                except ValueError:
                    pass
        
        # 提取问题
        issues = []
        issues_section = re.search(r'【发现的问题】\s*(.*?)\s*【', result, re.DOTALL)
        if issues_section:
            lines = issues_section.group(1).strip().split('\n')
            for line in lines:
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-')):
                    # 移除序号
                    issue = re.sub(r'^[\d\-\.]+\s*', '', line).strip()
                    if issue:
                        issues.append(issue)
        
        # 提取建议
        suggestions = []
        suggestions_section = re.search(r'【改进建议】\s*(.*?)$', result, re.DOTALL)
        if suggestions_section:
            lines = suggestions_section.group(1).strip().split('\n')
            for line in lines:
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-')):
                    # 移除序号
                    suggestion = re.sub(r'^[\d\-\.]+\s*', '', line).strip()
                    if suggestion:
                        suggestions.append(suggestion)
        
        # 提取评估结论
        evaluation_text = ""
        conclusion_section = re.search(r'【评估结论】\s*(.*?)\s*【', result, re.DOTALL)
        if conclusion_section:
            evaluation_text = conclusion_section.group(1).strip()
        
        return EvaluationResult(
            score=scores["score"],
            completeness=scores["completeness"],
            accuracy=scores["accuracy"],
            style=scores["style"],
            citation=scores["citation"],
            issues=issues,
            suggestions=suggestions,
            evaluation_text=evaluation_text,
        )
    
    async def evaluate_stream(
        self,
        content: str,
        content_type: str,
        title: str,
        context: str = "",
    ):
        """
        流式评估
        
        Args:
            content: 待评估内容
            content_type: 内容类型
            title: 标题
            context: 文档背景
        
        Yields:
            评估文本块
        """
        chain = self.prompt | self.llm
        
        async for chunk in chain.astream({
            "context": context or "（无背景信息）",
            "content_type": content_type,
            "title": title,
            "content": content,
        }):
            yield chunk


def create_evaluation_chain() -> QualityEvaluationChain:
    """创建质量评估链"""
    return QualityEvaluationChain()
