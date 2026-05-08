"""
内容审核工作流

自动化审核文档内容的工作流，包括：
1. 质量评估
2. 文献引用检查
3. 格式规范检查
4. 生成审核报告
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from enum import Enum

from services.langchain.core.session_adapter import SessionAdapter, load_document_context
from services.langchain.chains.evaluation_chain import create_evaluation_chain
from services.langchain.tools.literature_tools import SearchLiteratureTool, ValidateEntityTool
from services.langchain.workflows.chapter_completion import WorkflowState

logger = logging.getLogger(__name__)


class ReviewLevel(str, Enum):
    """审核级别"""
    BASIC = "basic"        # 基础审核（质量评估）
    STANDARD = "standard"  # 标准审核（质量 + 引用）
    STRICT = "strict"      # 严格审核（质量 + 引用 + 格式）


class ContentReviewWorkflow:
    """
    内容审核工作流
    
    工作流程：
    1. 加载文档内容
    2. 质量评估
    3. 文献引用检查
    4. 格式规范检查
    5. 生成审核报告
    """
    
    def __init__(
        self,
        document_id: UUID,
        review_level: ReviewLevel = ReviewLevel.STANDARD,
        min_quality_score: float = 0.7,
    ):
        """
        初始化
        
        Args:
            document_id: 文档 ID
            review_level: 审核级别
            min_quality_score: 最低质量分数
        """
        self.document_id = document_id
        self.review_level = review_level
        self.min_quality_score = min_quality_score
        
        # 工作流状态
        self.state = WorkflowState.PENDING
        self.current_step = 0
        self.total_steps = 5
        self.error = None
        
        # 工作流结果
        self.quality_results = []
        self.citation_results = []
        self.format_results = []
        self.report = {}
    
    async def run(self) -> Dict[str, Any]:
        """
        运行工作流
        
        Returns:
            工作流结果
        """
        self.state = WorkflowState.RUNNING
        
        try:
            # 步骤 1：加载文档内容
            logger.info(f"[内容审核] 步骤 1/5: 加载文档内容 document_id={self.document_id}")
            self.current_step = 1
            context = await self._load_document()
            
            # 步骤 2：质量评估
            logger.info(f"[内容审核] 步骤 2/5: 质量评估")
            self.current_step = 2
            self.quality_results = await self._evaluate_quality(context)
            
            # 步骤 3：文献引用检查
            if self.review_level in (ReviewLevel.STANDARD, ReviewLevel.STRICT):
                logger.info(f"[内容审核] 步骤 3/5: 文献引用检查")
                self.current_step = 3
                self.citation_results = await self._check_citations(context)
            
            # 步骤 4：格式规范检查
            if self.review_level == ReviewLevel.STRICT:
                logger.info(f"[内容审核] 步骤 4/5: 格式规范检查")
                self.current_step = 4
                self.format_results = await self._check_format(context)
            
            # 步骤 5：生成审核报告
            logger.info(f"[内容审核] 步骤 5/5: 生成审核报告")
            self.current_step = 5
            self.report = await self._generate_report()
            
            # 完成
            self.state = WorkflowState.COMPLETED
            logger.info(
                f"[内容审核] 工作流完成 document_id={self.document_id} "
                f"pass={self.report.get('pass', False)}"
            )
            
            return self._build_result()
        
        except Exception as e:
            self.state = WorkflowState.FAILED
            self.error = str(e)
            logger.error(f"[内容审核] 工作流失败: {e}")
            return self._build_result()
    
    async def _load_document(self) -> Dict[str, Any]:
        """加载文档内容"""
        async with SessionAdapter.query_session() as db:
            context = await load_document_context(db, self.document_id)
            return context
    
    async def _evaluate_quality(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """质量评估"""
        results = []
        
        # 评估摘要
        summaries = context.get("summaries", [])
        for summary in summaries:
            try:
                chain = create_evaluation_chain()
                result = await chain.ainvoke({
                    "content": summary.get("content", ""),
                    "document_context": context,
                })
                
                results.append({
                    "type": "summary",
                    "id": summary.get("summary_id"),
                    "title": summary.get("title"),
                    "evaluation": result,
                })
            
            except Exception as e:
                logger.error(f"[内容审核] 评估摘要失败: {e}")
                results.append({
                    "type": "summary",
                    "id": summary.get("summary_id"),
                    "error": str(e),
                })
        
        # 评估段落
        chapters = context.get("chapters", [])
        for chapter in chapters:
            paragraphs = chapter.get("paragraphs", [])
            for paragraph in paragraphs:
                try:
                    chain = create_evaluation_chain()
                    result = await chain.ainvoke({
                        "content": paragraph.get("content", ""),
                        "document_context": context,
                    })
                    
                    results.append({
                        "type": "paragraph",
                        "id": paragraph.get("paragraph_id"),
                        "chapter_title": chapter.get("title"),
                        "evaluation": result,
                    })
                
                except Exception as e:
                    logger.error(f"[内容审核] 评估段落失败: {e}")
                    results.append({
                        "type": "paragraph",
                        "id": paragraph.get("paragraph_id"),
                        "error": str(e),
                    })
        
        logger.info(f"[内容审核] 评估了 {len(results)} 个内容项")
        return results
    
    async def _check_citations(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """文献引用检查"""
        results = []
        
        # 检查摘要引用
        summaries = context.get("summaries", [])
        for summary in summaries:
            content = summary.get("content", "")
            citations = self._extract_citations(content)
            
            if citations:
                # 验证引用的文献是否存在
                for citation in citations:
                    try:
                        tool = ValidateEntityTool()
                        result = await tool._arun(
                            entity_type="literature",
                            entity_id=citation,
                        )
                        
                        results.append({
                            "type": "summary",
                            "id": summary.get("summary_id"),
                            "citation": citation,
                            "valid": "exists" in result.lower(),
                        })
                    
                    except Exception as e:
                        logger.error(f"[内容审核] 验证引用失败: {e}")
                        results.append({
                            "type": "summary",
                            "id": summary.get("summary_id"),
                            "citation": citation,
                            "error": str(e),
                        })
        
        # 检查段落引用
        chapters = context.get("chapters", [])
        for chapter in chapters:
            paragraphs = chapter.get("paragraphs", [])
            for paragraph in paragraphs:
                content = paragraph.get("content", "")
                citations = self._extract_citations(content)
                
                if citations:
                    for citation in citations:
                        try:
                            tool = ValidateEntityTool()
                            result = await tool._arun(
                                entity_type="literature",
                                entity_id=citation,
                            )
                            
                            results.append({
                                "type": "paragraph",
                                "id": paragraph.get("paragraph_id"),
                                "citation": citation,
                                "valid": "exists" in result.lower(),
                            })
                        
                        except Exception as e:
                            logger.error(f"[内容审核] 验证引用失败: {e}")
                            results.append({
                                "type": "paragraph",
                                "id": paragraph.get("paragraph_id"),
                                "citation": citation,
                                "error": str(e),
                            })
        
        logger.info(f"[内容审核] 检查了 {len(results)} 个引用")
        return results
    
    async def _check_format(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """格式规范检查"""
        results = []
        
        # 检查章节结构
        chapters = context.get("chapters", [])
        
        # 规则 1：章节标题不能为空
        for chapter in chapters:
            if not chapter.get("title", "").strip():
                results.append({
                    "type": "chapter",
                    "id": chapter.get("chapter_id"),
                    "rule": "title_not_empty",
                    "pass": False,
                    "message": "章节标题不能为空",
                })
        
        # 规则 2：段落内容不能为空
        for chapter in chapters:
            paragraphs = chapter.get("paragraphs", [])
            for paragraph in paragraphs:
                if not paragraph.get("content", "").strip():
                    results.append({
                        "type": "paragraph",
                        "id": paragraph.get("paragraph_id"),
                        "rule": "content_not_empty",
                        "pass": False,
                        "message": "段落内容不能为空",
                    })
        
        # 规则 3：摘要标题不能为空
        summaries = context.get("summaries", [])
        for summary in summaries:
            if not summary.get("title", "").strip():
                results.append({
                    "type": "summary",
                    "id": summary.get("summary_id"),
                    "rule": "title_not_empty",
                    "pass": False,
                    "message": "摘要标题不能为空",
                })
        
        # 规则 4：摘要内容不能为空
        for summary in summaries:
            if not summary.get("content", "").strip():
                results.append({
                    "type": "summary",
                    "id": summary.get("summary_id"),
                    "rule": "content_not_empty",
                    "pass": False,
                    "message": "摘要内容不能为空",
                })
        
        logger.info(f"[内容审核] 检查了 {len(results)} 个格式问题")
        return results
    
    async def _generate_report(self) -> Dict[str, Any]:
        """生成审核报告"""
        # 统计质量评估结果
        quality_scores = [
            r["evaluation"].get("overall_score", 0)
            for r in self.quality_results
            if "evaluation" in r
        ]
        avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
        
        low_quality_count = sum(
            1 for score in quality_scores
            if score < self.min_quality_score
        )
        
        # 统计引用检查结果
        invalid_citations = [
            r for r in self.citation_results
            if not r.get("valid", True)
        ]
        
        # 统计格式检查结果
        format_issues = [
            r for r in self.format_results
            if not r.get("pass", True)
        ]
        
        # 判断是否通过审核
        pass_review = (
            avg_quality_score >= self.min_quality_score and
            len(invalid_citations) == 0 and
            len(format_issues) == 0
        )
        
        report = {
            "pass": pass_review,
            "review_level": self.review_level.value,
            "quality": {
                "avg_score": avg_quality_score,
                "min_score": self.min_quality_score,
                "low_quality_count": low_quality_count,
                "total_count": len(quality_scores),
            },
            "citations": {
                "invalid_count": len(invalid_citations),
                "total_count": len(self.citation_results),
                "invalid_items": invalid_citations,
            },
            "format": {
                "issue_count": len(format_issues),
                "total_checks": len(self.format_results),
                "issues": format_issues,
            },
        }
        
        logger.info(
            f"[内容审核] 审核报告生成完成 "
            f"pass={pass_review} quality={avg_quality_score:.2f}"
        )
        
        return report
    
    def _extract_citations(self, content: str) -> List[str]:
        """从内容中提取文献引用"""
        import re
        
        # 匹配 [数字] 格式的引用
        pattern = r'\[(\d+)\]'
        matches = re.findall(pattern, content)
        
        return list(set(matches))  # 去重
    
    def _build_result(self) -> Dict[str, Any]:
        """构建工作流结果"""
        return {
            "workflow": "content_review",
            "state": self.state.value,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "document_id": str(self.document_id),
            "review_level": self.review_level.value,
            "quality_results": self.quality_results,
            "citation_results": self.citation_results,
            "format_results": self.format_results,
            "report": self.report,
            "error": self.error,
        }
    
    def get_progress(self) -> Dict[str, Any]:
        """获取工作流进度"""
        return {
            "state": self.state.value,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress": self.current_step / self.total_steps,
        }


async def create_content_review_workflow(
    document_id: UUID,
    review_level: ReviewLevel = ReviewLevel.STANDARD,
    min_quality_score: float = 0.7,
) -> ContentReviewWorkflow:
    """
    创建内容审核工作流
    
    Args:
        document_id: 文档 ID
        review_level: 审核级别
        min_quality_score: 最低质量分数
    
    Returns:
        ContentReviewWorkflow 实例
    """
    workflow = ContentReviewWorkflow(
        document_id=document_id,
        review_level=review_level,
        min_quality_score=min_quality_score,
    )
    return workflow
