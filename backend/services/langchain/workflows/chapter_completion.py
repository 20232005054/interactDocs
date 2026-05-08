"""
章节完善工作流

自动化完善章节内容的工作流，包括：
1. 分析章节结构
2. 生成缺失段落
3. 优化现有内容
4. 质量评估
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from enum import Enum

from services.langchain.core.session_adapter import SessionAdapter, load_document_context
from services.langchain.chains.generation_chain import create_paragraph_generation_chain
from services.langchain.chains.evaluation_chain import create_evaluation_chain
from services.langchain.chains.refinement_chain import create_refinement_chain
from services.langchain.agents.editor_agent import create_editor_agent

logger = logging.getLogger(__name__)


class WorkflowState(str, Enum):
    """工作流状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ChapterCompletionWorkflow:
    """
    章节完善工作流
    
    工作流程：
    1. 加载章节上下文
    2. 分析章节结构（使用 EditorAgent）
    3. 生成缺失段落（使用 ParagraphGenerationChain）
    4. 评估内容质量（使用 QualityEvaluationChain）
    5. 优化内容（使用 ContentRefinementChain）
    6. 保存结果
    """
    
    def __init__(
        self,
        document_id: UUID,
        chapter_id: UUID,
        target_quality_score: float = 0.8,
        max_iterations: int = 3,
    ):
        """
        初始化
        
        Args:
            document_id: 文档 ID
            chapter_id: 章节 ID
            target_quality_score: 目标质量分数（0-1）
            max_iterations: 最大迭代次数
        """
        self.document_id = document_id
        self.chapter_id = chapter_id
        self.target_quality_score = target_quality_score
        self.max_iterations = max_iterations
        
        # 工作流状态
        self.state = WorkflowState.PENDING
        self.current_step = 0
        self.total_steps = 5
        self.error = None
        
        # 工作流结果
        self.analysis = None
        self.generated_paragraphs = []
        self.evaluation_results = []
        self.refinement_results = []
        self.final_quality_score = 0.0
    
    async def run(self) -> Dict[str, Any]:
        """
        运行工作流
        
        Returns:
            工作流结果
        """
        self.state = WorkflowState.RUNNING
        
        try:
            # 步骤 1：加载上下文
            logger.info(f"[章节完善] 步骤 1/5: 加载上下文 chapter_id={self.chapter_id}")
            self.current_step = 1
            context = await self._load_context()
            
            # 步骤 2：分析章节结构
            logger.info(f"[章节完善] 步骤 2/5: 分析章节结构")
            self.current_step = 2
            self.analysis = await self._analyze_chapter(context)
            
            # 步骤 3：生成缺失段落
            logger.info(f"[章节完善] 步骤 3/5: 生成缺失段落")
            self.current_step = 3
            self.generated_paragraphs = await self._generate_paragraphs(context)
            
            # 步骤 4：评估内容质量
            logger.info(f"[章节完善] 步骤 4/5: 评估内容质量")
            self.current_step = 4
            self.evaluation_results = await self._evaluate_quality(context)
            
            # 步骤 5：优化内容（如果需要）
            logger.info(f"[章节完善] 步骤 5/5: 优化内容")
            self.current_step = 5
            self.refinement_results = await self._refine_content(context)
            
            # 完成
            self.state = WorkflowState.COMPLETED
            logger.info(
                f"[章节完善] 工作流完成 chapter_id={self.chapter_id} "
                f"final_score={self.final_quality_score:.2f}"
            )
            
            return self._build_result()
        
        except Exception as e:
            self.state = WorkflowState.FAILED
            self.error = str(e)
            logger.error(f"[章节完善] 工作流失败: {e}")
            return self._build_result()
    
    async def _load_context(self) -> Dict[str, Any]:
        """加载章节上下文"""
        async with SessionAdapter.query_session() as db:
            context = await load_document_context(
                db,
                self.document_id,
                chapter_id=self.chapter_id,
            )
            return context
    
    async def _analyze_chapter(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """分析章节结构"""
        # 使用 EditorAgent 分析
        agent = await create_editor_agent(self.document_id)
        result = await agent.complete_chapter(
            self.chapter_id,
            requirements="分析章节结构，识别缺失或不完整的部分",
        )
        return result
    
    async def _generate_paragraphs(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成缺失段落"""
        generated = []
        
        # 从分析结果中提取建议
        suggestions = self.analysis.get("suggestions", [])
        
        # 筛选出创建段落的建议
        create_para_suggestions = [
            s for s in suggestions
            if s.get("type") == "create_paragraph"
        ]
        
        if not create_para_suggestions:
            logger.info("[章节完善] 无需生成新段落")
            return generated
        
        # 使用 ParagraphGenerationChain 生成段落
        chain = create_paragraph_generation_chain()
        
        for suggestion in create_para_suggestions:
            try:
                # 准备输入
                input_data = {
                    "document_context": context,
                    "chapter_title": context.get("chapter", {}).get("title", ""),
                    "requirements": suggestion.get("description", ""),
                }
                
                # 生成段落
                result = await chain.ainvoke(input_data)
                
                generated.append({
                    "suggestion": suggestion,
                    "content": result.get("content", ""),
                    "citations": result.get("citations", []),
                })
            
            except Exception as e:
                logger.error(f"[章节完善] 生成段落失败: {e}")
                generated.append({
                    "suggestion": suggestion,
                    "error": str(e),
                })
        
        logger.info(f"[章节完善] 生成了 {len(generated)} 个段落")
        return generated
    
    async def _evaluate_quality(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """评估内容质量"""
        results = []
        
        # 获取章节所有段落
        paragraphs = context.get("paragraphs", [])
        
        if not paragraphs:
            logger.info("[章节完善] 章节无段落，跳过评估")
            return results
        
        # 使用 QualityEvaluationChain 评估
        chain = create_evaluation_chain()
        
        for paragraph in paragraphs:
            try:
                # 准备输入
                input_data = {
                    "content": paragraph.get("content", ""),
                    "document_context": context,
                }
                
                # 评估
                result = await chain.ainvoke(input_data)
                
                results.append({
                    "paragraph_id": paragraph.get("paragraph_id"),
                    "evaluation": result,
                })
            
            except Exception as e:
                logger.error(f"[章节完善] 评估段落失败: {e}")
                results.append({
                    "paragraph_id": paragraph.get("paragraph_id"),
                    "error": str(e),
                })
        
        # 计算平均分数
        scores = [
            r["evaluation"].get("overall_score", 0)
            for r in results
            if "evaluation" in r
        ]
        self.final_quality_score = sum(scores) / len(scores) if scores else 0.0
        
        logger.info(f"[章节完善] 评估完成 avg_score={self.final_quality_score:.2f}")
        return results
    
    async def _refine_content(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """优化内容"""
        results = []
        
        # 如果质量分数已达标，跳过优化
        if self.final_quality_score >= self.target_quality_score:
            logger.info(
                f"[章节完善] 质量分数已达标 "
                f"({self.final_quality_score:.2f} >= {self.target_quality_score:.2f})，跳过优化"
            )
            return results
        
        # 筛选出需要优化的段落
        low_quality_paragraphs = [
            r for r in self.evaluation_results
            if "evaluation" in r and r["evaluation"].get("overall_score", 1.0) < self.target_quality_score
        ]
        
        if not low_quality_paragraphs:
            logger.info("[章节完善] 无需优化段落")
            return results
        
        # 使用 ContentRefinementChain 优化
        chain = create_refinement_chain()
        
        for item in low_quality_paragraphs:
            paragraph_id = item.get("paragraph_id")
            evaluation = item.get("evaluation", {})
            
            # 查找段落内容
            paragraph = next(
                (p for p in context.get("paragraphs", []) if p.get("paragraph_id") == paragraph_id),
                None
            )
            
            if not paragraph:
                continue
            
            try:
                # 准备输入
                input_data = {
                    "content": paragraph.get("content", ""),
                    "evaluation": evaluation,
                    "document_context": context,
                    "target_score": self.target_quality_score,
                }
                
                # 优化
                result = await chain.ainvoke(input_data)
                
                results.append({
                    "paragraph_id": paragraph_id,
                    "original_content": paragraph.get("content", ""),
                    "refined_content": result.get("refined_content", ""),
                    "improvement": result.get("improvement", ""),
                })
            
            except Exception as e:
                logger.error(f"[章节完善] 优化段落失败: {e}")
                results.append({
                    "paragraph_id": paragraph_id,
                    "error": str(e),
                })
        
        logger.info(f"[章节完善] 优化了 {len(results)} 个段落")
        return results
    
    def _build_result(self) -> Dict[str, Any]:
        """构建工作流结果"""
        return {
            "workflow": "chapter_completion",
            "state": self.state.value,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "document_id": str(self.document_id),
            "chapter_id": str(self.chapter_id),
            "analysis": self.analysis,
            "generated_paragraphs": self.generated_paragraphs,
            "evaluation_results": self.evaluation_results,
            "refinement_results": self.refinement_results,
            "final_quality_score": self.final_quality_score,
            "target_quality_score": self.target_quality_score,
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


async def create_chapter_completion_workflow(
    document_id: UUID,
    chapter_id: UUID,
    target_quality_score: float = 0.8,
    max_iterations: int = 3,
) -> ChapterCompletionWorkflow:
    """
    创建章节完善工作流
    
    Args:
        document_id: 文档 ID
        chapter_id: 章节 ID
        target_quality_score: 目标质量分数
        max_iterations: 最大迭代次数
    
    Returns:
        ChapterCompletionWorkflow 实例
    """
    workflow = ChapterCompletionWorkflow(
        document_id=document_id,
        chapter_id=chapter_id,
        target_quality_score=target_quality_score,
        max_iterations=max_iterations,
    )
    return workflow
