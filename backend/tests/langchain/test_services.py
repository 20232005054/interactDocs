"""
服务层测试

测试 LangChain 框架实现的服务层
"""

import pytest
from uuid import uuid4

from services.langchain.services import (
    AIService,
    AIChatService,
    LiteratureRagService,
    TemplateApplyService,
)


class TestAIService:
    """测试 AI 辅助编辑服务"""
    
    @pytest.mark.asyncio
    async def test_ai_assist_paragraph_interface(self):
        """测试段落帮填接口"""
        paragraph_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIService, "ai_assist_paragraph")
        assert callable(AIService.ai_assist_paragraph)
    
    @pytest.mark.asyncio
    async def test_ai_evaluate_paragraph_interface(self):
        """测试段落评估接口"""
        paragraph_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIService, "ai_evaluate_paragraph")
        assert callable(AIService.ai_evaluate_paragraph)
    
    @pytest.mark.asyncio
    async def test_assist_single_summary_interface(self):
        """测试摘要帮填接口"""
        summary_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIService, "assist_single_summary")
        assert callable(AIService.assist_single_summary)


class TestAIChatService:
    """测试 AI 对话服务"""
    
    @pytest.mark.asyncio
    async def test_chat_stream_interface(self):
        """测试流式对话接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIChatService, "chat_stream")
        assert callable(AIChatService.chat_stream)
    
    @pytest.mark.asyncio
    async def test_chat_interface(self):
        """测试非流式对话接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIChatService, "chat")
        assert callable(AIChatService.chat)


class TestLiteratureRagService:
    """测试文献 RAG 检索服务"""
    
    @pytest.mark.asyncio
    async def test_retrieve_and_format_interface(self):
        """测试模板级检索接口"""
        template_id = uuid4()
        user_id = uuid4()
        
        # 测试接口存在
        assert hasattr(LiteratureRagService, "retrieve_and_format")
        assert callable(LiteratureRagService.retrieve_and_format)
    
    @pytest.mark.asyncio
    async def test_retrieve_and_format_for_paragraph_interface(self):
        """测试段落级检索接口"""
        paragraph_id = uuid4()
        template_id = uuid4()
        user_id = uuid4()
        
        # 测试接口存在
        assert hasattr(LiteratureRagService, "retrieve_and_format_for_paragraph")
        assert callable(LiteratureRagService.retrieve_and_format_for_paragraph)
    
    @pytest.mark.asyncio
    async def test_inject_into_prompt(self):
        """测试注入 prompt"""
        base_prompt = "这是基础 prompt"
        context_str = "这是文献上下文"
        
        result = LiteratureRagService.inject_into_prompt(base_prompt, context_str)
        
        assert base_prompt in result
        assert context_str in result
    
    @pytest.mark.asyncio
    async def test_format_vancouver_reference(self):
        """测试温哥华引文格式"""
        citation = {
            "authors": "张三, 李四",
            "title": "测试文献",
            "journal": "测试期刊",
            "publish_date": None,
            "doi": "10.1234/test",
        }
        
        result = LiteratureRagService.format_vancouver_reference(citation, 1)
        
        assert "[1]" in result
        assert "张三, 李四" in result
        assert "测试文献" in result
        assert "测试期刊" in result
        assert "10.1234/test" in result


class TestTemplateApplyService:
    """测试模板应用服务"""
    
    @pytest.mark.asyncio
    async def test_apply_core_info_template_interface(self):
        """测试应用核心信息模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyService, "apply_core_info_template")
        assert callable(TemplateApplyService.apply_core_info_template)
    
    @pytest.mark.asyncio
    async def test_apply_core_info_template_as_tree_interface(self):
        """测试应用核心信息模板（树形）接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyService, "apply_core_info_template_as_tree")
        assert callable(TemplateApplyService.apply_core_info_template_as_tree)
    
    @pytest.mark.asyncio
    async def test_apply_summary_template_interface(self):
        """测试应用摘要模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyService, "apply_summary_template")
        assert callable(TemplateApplyService.apply_summary_template)
    
    @pytest.mark.asyncio
    async def test_apply_structure_template_interface(self):
        """测试应用章节结构模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyService, "apply_structure_template")
        assert callable(TemplateApplyService.apply_structure_template)


class TestServiceIntegration:
    """测试服务集成"""
    
    @pytest.mark.asyncio
    async def test_all_services_exist(self):
        """测试所有服务都存在"""
        # 验证服务类存在
        assert AIService is not None
        assert AIChatService is not None
        assert LiteratureRagService is not None
        assert TemplateApplyService is not None
    
    @pytest.mark.asyncio
    async def test_service_interfaces_compatible(self):
        """测试服务接口兼容性"""
        # AIService 接口
        assert hasattr(AIService, "ai_assist_paragraph")
        assert hasattr(AIService, "ai_evaluate_paragraph")
        assert hasattr(AIService, "assist_single_summary")
        
        # AIChatService 接口
        assert hasattr(AIChatService, "chat_stream")
        assert hasattr(AIChatService, "chat")
        
        # LiteratureRagService 接口
        assert hasattr(LiteratureRagService, "retrieve_and_format")
        assert hasattr(LiteratureRagService, "retrieve_and_format_for_paragraph")
        assert hasattr(LiteratureRagService, "inject_into_prompt")
        assert hasattr(LiteratureRagService, "save_citations")
        assert hasattr(LiteratureRagService, "get_document_reference_list")
        assert hasattr(LiteratureRagService, "format_vancouver_reference")
        
        # TemplateApplyService 接口
        assert hasattr(TemplateApplyService, "apply_core_info_template")
        assert hasattr(TemplateApplyService, "apply_core_info_template_as_tree")
        assert hasattr(TemplateApplyService, "apply_summary_template")
        assert hasattr(TemplateApplyService, "apply_structure_template")
