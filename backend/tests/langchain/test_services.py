"""
服务层 v2 测试

测试 LangChain 框架实现的服务层
"""

import pytest
from uuid import uuid4

from services.langchain.services import (
    AIServiceV2,
    AIChatServiceV2,
    LiteratureRagServiceV2,
    TemplateApplyServiceV2,
)


class TestAIServiceV2:
    """测试 AI 辅助编辑服务 v2"""
    
    @pytest.mark.asyncio
    async def test_ai_assist_paragraph_interface(self):
        """测试段落帮填接口"""
        paragraph_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIServiceV2, "ai_assist_paragraph")
        assert callable(AIServiceV2.ai_assist_paragraph)
    
    @pytest.mark.asyncio
    async def test_ai_evaluate_paragraph_interface(self):
        """测试段落评估接口"""
        paragraph_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIServiceV2, "ai_evaluate_paragraph")
        assert callable(AIServiceV2.ai_evaluate_paragraph)
    
    @pytest.mark.asyncio
    async def test_assist_single_summary_interface(self):
        """测试摘要帮填接口"""
        summary_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIServiceV2, "assist_single_summary")
        assert callable(AIServiceV2.assist_single_summary)


class TestAIChatServiceV2:
    """测试 AI 对话服务 v2"""
    
    @pytest.mark.asyncio
    async def test_chat_stream_interface(self):
        """测试流式对话接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIChatServiceV2, "chat_stream")
        assert callable(AIChatServiceV2.chat_stream)
    
    @pytest.mark.asyncio
    async def test_chat_interface(self):
        """测试非流式对话接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(AIChatServiceV2, "chat")
        assert callable(AIChatServiceV2.chat)


class TestLiteratureRagServiceV2:
    """测试文献 RAG 检索服务 v2"""
    
    @pytest.mark.asyncio
    async def test_retrieve_and_format_interface(self):
        """测试模板级检索接口"""
        template_id = uuid4()
        user_id = uuid4()
        
        # 测试接口存在
        assert hasattr(LiteratureRagServiceV2, "retrieve_and_format")
        assert callable(LiteratureRagServiceV2.retrieve_and_format)
    
    @pytest.mark.asyncio
    async def test_retrieve_and_format_for_paragraph_interface(self):
        """测试段落级检索接口"""
        paragraph_id = uuid4()
        template_id = uuid4()
        user_id = uuid4()
        
        # 测试接口存在
        assert hasattr(LiteratureRagServiceV2, "retrieve_and_format_for_paragraph")
        assert callable(LiteratureRagServiceV2.retrieve_and_format_for_paragraph)
    
    @pytest.mark.asyncio
    async def test_inject_into_prompt(self):
        """测试注入 prompt"""
        base_prompt = "这是基础 prompt"
        context_str = "这是文献上下文"
        
        result = LiteratureRagServiceV2.inject_into_prompt(base_prompt, context_str)
        
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
        
        result = LiteratureRagServiceV2.format_vancouver_reference(citation, 1)
        
        assert "[1]" in result
        assert "张三, 李四" in result
        assert "测试文献" in result
        assert "测试期刊" in result
        assert "10.1234/test" in result


class TestTemplateApplyServiceV2:
    """测试模板应用服务 v2"""
    
    @pytest.mark.asyncio
    async def test_apply_core_info_template_interface(self):
        """测试应用核心信息模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyServiceV2, "apply_core_info_template")
        assert callable(TemplateApplyServiceV2.apply_core_info_template)
    
    @pytest.mark.asyncio
    async def test_apply_core_info_template_as_tree_interface(self):
        """测试应用核心信息模板（树形）接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyServiceV2, "apply_core_info_template_as_tree")
        assert callable(TemplateApplyServiceV2.apply_core_info_template_as_tree)
    
    @pytest.mark.asyncio
    async def test_apply_summary_template_interface(self):
        """测试应用摘要模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyServiceV2, "apply_summary_template")
        assert callable(TemplateApplyServiceV2.apply_summary_template)
    
    @pytest.mark.asyncio
    async def test_apply_structure_template_interface(self):
        """测试应用章节结构模板接口"""
        document_id = uuid4()
        
        # 测试接口存在
        assert hasattr(TemplateApplyServiceV2, "apply_structure_template")
        assert callable(TemplateApplyServiceV2.apply_structure_template)


class TestServiceIntegration:
    """测试服务集成"""
    
    @pytest.mark.asyncio
    async def test_all_services_exist(self):
        """测试所有服务都存在"""
        # 验证服务类存在
        assert AIServiceV2 is not None
        assert AIChatServiceV2 is not None
        assert LiteratureRagServiceV2 is not None
        assert TemplateApplyServiceV2 is not None
    
    @pytest.mark.asyncio
    async def test_service_interfaces_compatible(self):
        """测试服务接口兼容性"""
        # AIServiceV2 接口
        assert hasattr(AIServiceV2, "ai_assist_paragraph")
        assert hasattr(AIServiceV2, "ai_evaluate_paragraph")
        assert hasattr(AIServiceV2, "assist_single_summary")
        
        # AIChatServiceV2 接口
        assert hasattr(AIChatServiceV2, "chat_stream")
        assert hasattr(AIChatServiceV2, "chat")
        
        # LiteratureRagServiceV2 接口
        assert hasattr(LiteratureRagServiceV2, "retrieve_and_format")
        assert hasattr(LiteratureRagServiceV2, "retrieve_and_format_for_paragraph")
        assert hasattr(LiteratureRagServiceV2, "inject_into_prompt")
        assert hasattr(LiteratureRagServiceV2, "save_citations")
        assert hasattr(LiteratureRagServiceV2, "get_document_reference_list")
        assert hasattr(LiteratureRagServiceV2, "format_vancouver_reference")
        
        # TemplateApplyServiceV2 接口
        assert hasattr(TemplateApplyServiceV2, "apply_core_info_template")
        assert hasattr(TemplateApplyServiceV2, "apply_core_info_template_as_tree")
        assert hasattr(TemplateApplyServiceV2, "apply_summary_template")
        assert hasattr(TemplateApplyServiceV2, "apply_structure_template")
