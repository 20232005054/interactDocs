"""
核心组件测试

测试 LLM、VectorStore、SessionAdapter、MemoryManager
"""

import pytest
import asyncio
from uuid import uuid4

from services.langchain.core.llm_factory import get_qwen_llm, QwenLLM
from services.langchain.core.vector_stores import QwenEmbeddings, create_vector_store
from services.langchain.core.session_adapter import SessionAdapter, DocumentContext
from services.langchain.core.memory_manager import create_memory_manager, EntityMemory


class TestQwenLLM:
    """测试 QwenLLM"""
    
    @pytest.mark.asyncio
    async def test_get_qwen_llm(self):
        """测试获取 LLM 实例"""
        llm = get_qwen_llm()
        assert isinstance(llm, QwenLLM)
        assert llm.model_name is not None
    
    @pytest.mark.asyncio
    async def test_llm_cache(self):
        """测试 LLM 缓存"""
        llm1 = get_qwen_llm()
        llm2 = get_qwen_llm()
        assert llm1 is llm2  # 应该是同一个实例
    
    @pytest.mark.asyncio
    async def test_llm_acall(self):
        """测试异步调用（需要真实 API Key）"""
        # 跳过，需要真实环境
        pytest.skip("需要真实 API Key")
        
        llm = get_qwen_llm()
        result = await llm._acall(
            prompt="你好",
            system_prompt="你是一个助手",
            history=[],
        )
        assert isinstance(result, str)
        assert len(result) > 0


class TestQwenEmbeddings:
    """测试 QwenEmbeddings"""
    
    @pytest.mark.asyncio
    async def test_aembed_query(self):
        """测试嵌入查询（需要真实 API Key）"""
        # 跳过，需要真实环境
        pytest.skip("需要真实 API Key")
        
        embeddings = QwenEmbeddings()
        result = await embeddings.aembed_query("测试文本")
        assert isinstance(result, list)
        assert len(result) > 0


class TestSessionAdapter:
    """测试 SessionAdapter"""
    
    @pytest.mark.asyncio
    async def test_prepare_document_context(self):
        """测试准备文档上下文（需要数据库）"""
        # 跳过，需要真实数据库
        pytest.skip("需要真实数据库")
        
        document_id = uuid4()
        context = await SessionAdapter.prepare_document_context(document_id)
        assert isinstance(context, DocumentContext)
        assert context.document_id == document_id
    
    @pytest.mark.asyncio
    async def test_query_session(self):
        """测试查询 Session"""
        async with SessionAdapter.query_session() as db:
            assert db is not None


class TestMemoryManager:
    """测试 MemoryManager"""
    
    def test_create_memory_manager(self):
        """测试创建记忆管理器"""
        document_id = uuid4()
        manager = create_memory_manager(document_id)
        assert manager.document_id == document_id
    
    def test_add_messages(self):
        """测试添加消息"""
        document_id = uuid4()
        manager = create_memory_manager(document_id)
        
        manager.add_user_message("你好")
        manager.add_ai_message("你好，有什么可以帮助你的？")
        
        messages = manager.get_messages()
        assert len(messages) == 2
    
    def test_clear_memory(self):
        """测试清空记忆"""
        document_id = uuid4()
        manager = create_memory_manager(document_id)
        
        manager.add_user_message("你好")
        manager.clear()
        
        messages = manager.get_messages()
        assert len(messages) == 0


class TestEntityMemory:
    """测试 EntityMemory"""
    
    def test_add_entity(self):
        """测试添加实体"""
        memory = EntityMemory()
        memory.add_entity("chapter", "123", {"title": "测试章节"})
        
        entity = memory.get_entity("chapter", "123")
        assert entity is not None
        assert entity["data"]["title"] == "测试章节"
    
    def test_get_entities_by_type(self):
        """测试按类型获取实体"""
        memory = EntityMemory()
        memory.add_entity("chapter", "1", {"title": "章节1"})
        memory.add_entity("chapter", "2", {"title": "章节2"})
        memory.add_entity("paragraph", "3", {"content": "段落3"})
        
        chapters = memory.get_entities_by_type("chapter")
        assert len(chapters) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
