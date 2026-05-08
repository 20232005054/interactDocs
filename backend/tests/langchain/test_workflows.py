"""
工作流测试

测试三种工作流的基本功能
"""

import pytest
from uuid import uuid4

from services.langchain.workflows import (
    ChapterCompletionWorkflow,
    DocumentGenerationWorkflow,
    ContentReviewWorkflow,
    create_chapter_completion_workflow,
    create_document_generation_workflow,
    create_content_review_workflow,
)
from services.langchain.workflows.chapter_completion import WorkflowState
from services.langchain.workflows.content_review import ReviewLevel


class TestChapterCompletionWorkflow:
    """测试章节完善工作流"""
    
    @pytest.mark.asyncio
    async def test_create_workflow(self):
        """测试创建工作流"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = ChapterCompletionWorkflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        assert workflow.document_id == document_id
        assert workflow.chapter_id == chapter_id
        assert workflow.state == WorkflowState.PENDING
        assert workflow.current_step == 0
        assert workflow.total_steps == 5
    
    @pytest.mark.asyncio
    async def test_get_progress(self):
        """测试获取进度"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = ChapterCompletionWorkflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        progress = workflow.get_progress()
        
        assert progress["state"] == WorkflowState.PENDING.value
        assert progress["current_step"] == 0
        assert progress["total_steps"] == 5
        assert progress["progress"] == 0.0
    
    @pytest.mark.asyncio
    async def test_build_result(self):
        """测试构建结果"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = ChapterCompletionWorkflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        result = workflow._build_result()
        
        assert result["workflow"] == "chapter_completion"
        assert result["state"] == WorkflowState.PENDING.value
        assert result["document_id"] == str(document_id)
        assert result["chapter_id"] == str(chapter_id)
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = await create_chapter_completion_workflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        assert isinstance(workflow, ChapterCompletionWorkflow)
        assert workflow.document_id == document_id
        assert workflow.chapter_id == chapter_id


class TestDocumentGenerationWorkflow:
    """测试文档生成工作流"""
    
    @pytest.mark.asyncio
    async def test_create_workflow(self):
        """测试创建工作流"""
        document_id = uuid4()
        template_id = uuid4()
        
        workflow = DocumentGenerationWorkflow(
            document_id=document_id,
            template_id=template_id,
        )
        
        assert workflow.document_id == document_id
        assert workflow.template_id == template_id
        assert workflow.state == WorkflowState.PENDING
        assert workflow.generate_mode == "full"
    
    @pytest.mark.asyncio
    async def test_generate_modes(self):
        """测试生成模式"""
        document_id = uuid4()
        template_id = uuid4()
        
        modes = ["full", "core_only", "summary_only", "structure_only"]
        
        for mode in modes:
            workflow = DocumentGenerationWorkflow(
                document_id=document_id,
                template_id=template_id,
                generate_mode=mode,
            )
            
            assert workflow.generate_mode == mode
    
    @pytest.mark.asyncio
    async def test_get_progress(self):
        """测试获取进度"""
        document_id = uuid4()
        template_id = uuid4()
        
        workflow = DocumentGenerationWorkflow(
            document_id=document_id,
            template_id=template_id,
        )
        
        progress = workflow.get_progress()
        
        assert progress["state"] == WorkflowState.PENDING.value
        assert progress["current_step"] == 0
        assert progress["total_steps"] == 5
    
    @pytest.mark.asyncio
    async def test_build_result(self):
        """测试构建结果"""
        document_id = uuid4()
        template_id = uuid4()
        
        workflow = DocumentGenerationWorkflow(
            document_id=document_id,
            template_id=template_id,
        )
        
        result = workflow._build_result()
        
        assert result["workflow"] == "document_generation"
        assert result["state"] == WorkflowState.PENDING.value
        assert result["document_id"] == str(document_id)
        assert result["template_id"] == str(template_id)
        assert result["generate_mode"] == "full"
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        template_id = uuid4()
        
        workflow = await create_document_generation_workflow(
            document_id=document_id,
            template_id=template_id,
        )
        
        assert isinstance(workflow, DocumentGenerationWorkflow)
        assert workflow.document_id == document_id
        assert workflow.template_id == template_id


class TestContentReviewWorkflow:
    """测试内容审核工作流"""
    
    @pytest.mark.asyncio
    async def test_create_workflow(self):
        """测试创建工作流"""
        document_id = uuid4()
        
        workflow = ContentReviewWorkflow(
            document_id=document_id,
        )
        
        assert workflow.document_id == document_id
        assert workflow.state == WorkflowState.PENDING
        assert workflow.review_level == ReviewLevel.STANDARD
        assert workflow.min_quality_score == 0.7
    
    @pytest.mark.asyncio
    async def test_review_levels(self):
        """测试审核级别"""
        document_id = uuid4()
        
        levels = [ReviewLevel.BASIC, ReviewLevel.STANDARD, ReviewLevel.STRICT]
        
        for level in levels:
            workflow = ContentReviewWorkflow(
                document_id=document_id,
                review_level=level,
            )
            
            assert workflow.review_level == level
    
    @pytest.mark.asyncio
    async def test_extract_citations(self):
        """测试提取引用"""
        document_id = uuid4()
        
        workflow = ContentReviewWorkflow(
            document_id=document_id,
        )
        
        # 测试提取引用
        content = "这是一段文本[1]，包含多个引用[2][3]。"
        citations = workflow._extract_citations(content)
        
        assert len(citations) == 3
        assert "1" in citations
        assert "2" in citations
        assert "3" in citations
    
    @pytest.mark.asyncio
    async def test_get_progress(self):
        """测试获取进度"""
        document_id = uuid4()
        
        workflow = ContentReviewWorkflow(
            document_id=document_id,
        )
        
        progress = workflow.get_progress()
        
        assert progress["state"] == WorkflowState.PENDING.value
        assert progress["current_step"] == 0
        assert progress["total_steps"] == 5
    
    @pytest.mark.asyncio
    async def test_build_result(self):
        """测试构建结果"""
        document_id = uuid4()
        
        workflow = ContentReviewWorkflow(
            document_id=document_id,
        )
        
        result = workflow._build_result()
        
        assert result["workflow"] == "content_review"
        assert result["state"] == WorkflowState.PENDING.value
        assert result["document_id"] == str(document_id)
        assert result["review_level"] == ReviewLevel.STANDARD.value
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        
        workflow = await create_content_review_workflow(
            document_id=document_id,
        )
        
        assert isinstance(workflow, ContentReviewWorkflow)
        assert workflow.document_id == document_id


class TestWorkflowIntegration:
    """测试工作流集成"""
    
    @pytest.mark.asyncio
    async def test_all_workflows_created(self):
        """测试所有工作流都能创建"""
        document_id = uuid4()
        chapter_id = uuid4()
        template_id = uuid4()
        
        # 创建三个工作流
        chapter_workflow = await create_chapter_completion_workflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        doc_workflow = await create_document_generation_workflow(
            document_id=document_id,
            template_id=template_id,
        )
        
        review_workflow = await create_content_review_workflow(
            document_id=document_id,
        )
        
        # 验证
        assert isinstance(chapter_workflow, ChapterCompletionWorkflow)
        assert isinstance(doc_workflow, DocumentGenerationWorkflow)
        assert isinstance(review_workflow, ContentReviewWorkflow)
    
    @pytest.mark.asyncio
    async def test_workflow_states(self):
        """测试工作流状态"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = ChapterCompletionWorkflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        # 初始状态
        assert workflow.state == WorkflowState.PENDING
        
        # 模拟状态变化
        workflow.state = WorkflowState.RUNNING
        assert workflow.state == WorkflowState.RUNNING
        
        workflow.state = WorkflowState.COMPLETED
        assert workflow.state == WorkflowState.COMPLETED
    
    @pytest.mark.asyncio
    async def test_workflow_progress_tracking(self):
        """测试工作流进度追踪"""
        document_id = uuid4()
        chapter_id = uuid4()
        
        workflow = ChapterCompletionWorkflow(
            document_id=document_id,
            chapter_id=chapter_id,
        )
        
        # 模拟进度变化
        for step in range(1, 6):
            workflow.current_step = step
            progress = workflow.get_progress()
            
            assert progress["current_step"] == step
            assert progress["progress"] == step / 5
