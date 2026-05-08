"""
文档生成工作流

自动化生成完整文档的工作流，包括：
1. 应用模板
2. 生成核心信息
3. 生成摘要
4. 生成章节结构
5. 生成段落内容
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from enum import Enum

from services.langchain.core.session_adapter import SessionAdapter
from services.langchain.chains.generation_chain import (
    create_paragraph_generation_chain,
    create_summary_generation_chain,
)
from services.langchain.workflows.chapter_completion import WorkflowState

logger = logging.getLogger(__name__)


class DocumentGenerationWorkflow:
    """
    文档生成工作流
    
    工作流程：
    1. 应用核心信息模板
    2. 应用摘要模板
    3. 应用章节结构模板
    4. 批量生成段落内容
    5. 建立依赖关系
    """
    
    def __init__(
        self,
        document_id: UUID,
        template_id: UUID,
        generate_mode: str = "full",  # full, core_only, summary_only, structure_only
    ):
        """
        初始化
        
        Args:
            document_id: 文档 ID
            template_id: 模板 ID
            generate_mode: 生成模式
        """
        self.document_id = document_id
        self.template_id = template_id
        self.generate_mode = generate_mode
        
        # 工作流状态
        self.state = WorkflowState.PENDING
        self.current_step = 0
        self.total_steps = 5
        self.error = None
        
        # 工作流结果
        self.core_info_count = 0
        self.summary_count = 0
        self.chapter_count = 0
        self.paragraph_count = 0
        self.dependency_count = 0
    
    async def run(self) -> Dict[str, Any]:
        """
        运行工作流
        
        Returns:
            工作流结果
        """
        self.state = WorkflowState.RUNNING
        
        try:
            # 步骤 1：应用核心信息模板
            if self.generate_mode in ("full", "core_only"):
                logger.info(f"[文档生成] 步骤 1/5: 应用核心信息模板 document_id={self.document_id}")
                self.current_step = 1
                await self._apply_core_info_template()
            
            # 步骤 2：应用摘要模板
            if self.generate_mode in ("full", "summary_only"):
                logger.info(f"[文档生成] 步骤 2/5: 应用摘要模板")
                self.current_step = 2
                await self._apply_summary_template()
            
            # 步骤 3：应用章节结构模板
            if self.generate_mode in ("full", "structure_only"):
                logger.info(f"[文档生成] 步骤 3/5: 应用章节结构模板")
                self.current_step = 3
                await self._apply_structure_template()
            
            # 步骤 4：生成段落内容（如果需要）
            if self.generate_mode == "full":
                logger.info(f"[文档生成] 步骤 4/5: 生成段落内容")
                self.current_step = 4
                await self._generate_paragraphs()
            
            # 步骤 5：建立依赖关系
            if self.generate_mode == "full":
                logger.info(f"[文档生成] 步骤 5/5: 建立依赖关系")
                self.current_step = 5
                await self._build_dependencies()
            
            # 完成
            self.state = WorkflowState.COMPLETED
            logger.info(
                f"[文档生成] 工作流完成 document_id={self.document_id} "
                f"core_info={self.core_info_count} summary={self.summary_count} "
                f"chapter={self.chapter_count} paragraph={self.paragraph_count}"
            )
            
            return self._build_result()
        
        except Exception as e:
            self.state = WorkflowState.FAILED
            self.error = str(e)
            logger.error(f"[文档生成] 工作流失败: {e}")
            return self._build_result()
    
    async def _apply_core_info_template(self):
        """应用核心信息模板"""
        from services.langchain.services.template_apply_service import TemplateApplyService
        
        async with SessionAdapter.save_session() as db:
            tree, count = await TemplateApplyService.apply_core_info_template_as_tree(
                db, self.document_id
            )
            self.core_info_count = count
            logger.info(f"[文档生成] 创建了 {count} 个核心信息字段")
    
    async def _apply_summary_template(self):
        """应用摘要模板"""
        from services.langchain.services.template_apply_service import TemplateApplyService
        
        async with SessionAdapter.save_session() as db:
            items = await TemplateApplyService.apply_summary_template(
                db, self.document_id
            )
            self.summary_count = len(items)
            logger.info(f"[文档生成] 创建了 {len(items)} 个摘要")
    
    async def _apply_structure_template(self):
        """应用章节结构模板"""
        from services.langchain.services.template_apply_service import TemplateApplyService
        
        async with SessionAdapter.save_session() as db:
            items = await TemplateApplyService.apply_structure_template(
                db, self.document_id
            )
            self.chapter_count = len(items)
            
            # 统计段落数
            paragraph_count = sum(
                len(item.get("paragraphs", []))
                for item in items
            )
            self.paragraph_count = paragraph_count
            
            logger.info(
                f"[文档生成] 创建了 {len(items)} 个章节，"
                f"{paragraph_count} 个段落"
            )
    
    async def _generate_paragraphs(self):
        """生成段落内容（补充 AI 生成）"""
        # 注意：apply_structure_template 已经处理了 AI 生成
        # 这里可以添加额外的段落生成逻辑
        logger.info("[文档生成] 段落内容已在模板应用时生成")
    
    async def _build_dependencies(self):
        """建立依赖关系"""
        # 注意：依赖关系已在模板应用时建立
        # 这里可以添加额外的依赖关系验证逻辑
        from services.dependency_service import DependencyService
        
        async with SessionAdapter.query_session() as db:
            # 获取依赖边数量
            from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
            edges = await DependencyEdgeMapper.get_edges_by_document(db, self.document_id)
            self.dependency_count = len(edges)
            
            logger.info(f"[文档生成] 建立了 {len(edges)} 条依赖关系")
    
    def _build_result(self) -> Dict[str, Any]:
        """构建工作流结果"""
        return {
            "workflow": "document_generation",
            "state": self.state.value,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "document_id": str(self.document_id),
            "template_id": str(self.template_id),
            "generate_mode": self.generate_mode,
            "core_info_count": self.core_info_count,
            "summary_count": self.summary_count,
            "chapter_count": self.chapter_count,
            "paragraph_count": self.paragraph_count,
            "dependency_count": self.dependency_count,
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


async def create_document_generation_workflow(
    document_id: UUID,
    template_id: UUID,
    generate_mode: str = "full",
) -> DocumentGenerationWorkflow:
    """
    创建文档生成工作流
    
    Args:
        document_id: 文档 ID
        template_id: 模板 ID
        generate_mode: 生成模式
    
    Returns:
        DocumentGenerationWorkflow 实例
    """
    workflow = DocumentGenerationWorkflow(
        document_id=document_id,
        template_id=template_id,
        generate_mode=generate_mode,
    )
    return workflow
