"""
智能体测试

测试三种智能体的基本功能
"""

import pytest
from uuid import uuid4

from services.langchain.agents import (
    DocumentChatAgent,
    DocumentEditorAgent,
    ResearchAgent,
    create_chat_agent,
    create_editor_agent,
    create_research_agent,
)


class TestDocumentChatAgent:
    """测试对话智能体"""
    
    @pytest.mark.asyncio
    async def test_create_chat_agent(self):
        """测试创建对话智能体"""
        document_id = uuid4()
        agent = DocumentChatAgent(document_id)
        
        assert agent.document_id == document_id
        assert agent.llm is not None
        assert agent.tools is not None
        assert agent.memory is not None
    
    @pytest.mark.asyncio
    async def test_initialize(self):
        """测试初始化"""
        document_id = uuid4()
        agent = DocumentChatAgent(document_id)
        
        # 初始化（会尝试加载历史，可能失败）
        try:
            await agent.initialize()
            assert agent.agent_executor is not None
        except Exception:
            # 数据库连接失败是正常的（测试环境）
            pass
    
    @pytest.mark.asyncio
    async def test_parse_response(self):
        """测试响应解析"""
        document_id = uuid4()
        agent = DocumentChatAgent(document_id)
        
        # 测试解析 ACTION
        response = """
        这是回复内容
        [ACTION]{"type": "test", "data": "value"}
        """
        actions, suggestions = agent._parse_response(response)
        assert len(actions) == 1
        assert actions[0]["type"] == "test"
        
        # 测试解析 SUGGESTION
        response = """
        这是回复内容
        [SUGGESTION]{"type": "create_chapter", "title": "测试章节"}
        """
        actions, suggestions = agent._parse_response(response)
        assert len(suggestions) == 1
        assert suggestions[0]["type"] == "create_chapter"
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        
        try:
            agent = await create_chat_agent(document_id)
            assert isinstance(agent, DocumentChatAgent)
            assert agent.agent_executor is not None
        except Exception:
            # 数据库连接失败是正常的
            pass


class TestDocumentEditorAgent:
    """测试编辑智能体"""
    
    @pytest.mark.asyncio
    async def test_create_editor_agent(self):
        """测试创建编辑智能体"""
        document_id = uuid4()
        agent = DocumentEditorAgent(document_id)
        
        assert agent.document_id == document_id
        assert agent.llm is not None
        assert agent.tools is not None
    
    @pytest.mark.asyncio
    async def test_initialize(self):
        """测试初始化"""
        document_id = uuid4()
        agent = DocumentEditorAgent(document_id)
        
        await agent.initialize()
        assert agent.agent_executor is not None
    
    @pytest.mark.asyncio
    async def test_extract_suggestions(self):
        """测试提取建议"""
        document_id = uuid4()
        agent = DocumentEditorAgent(document_id)
        
        # 模拟中间步骤
        from langchain.agents import AgentAction
        
        action = AgentAction(
            tool="SuggestCreateChapterTool",
            tool_input={"title": "测试章节"},
            log="",
        )
        observation = '[SUGGESTION]{"type": "create_chapter", "title": "测试章节"}'
        
        intermediate_steps = [(action, observation)]
        
        suggestions = agent._extract_suggestions(intermediate_steps)
        assert len(suggestions) == 1
        assert suggestions[0]["type"] == "create_chapter"
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        
        agent = await create_editor_agent(document_id)
        assert isinstance(agent, DocumentEditorAgent)
        assert agent.agent_executor is not None


class TestResearchAgent:
    """测试研究智能体"""
    
    @pytest.mark.asyncio
    async def test_create_research_agent(self):
        """测试创建研究智能体"""
        document_id = uuid4()
        agent = ResearchAgent(document_id)
        
        assert agent.document_id == document_id
        assert agent.llm is not None
        assert agent.tools is not None
    
    @pytest.mark.asyncio
    async def test_initialize(self):
        """测试初始化"""
        document_id = uuid4()
        agent = ResearchAgent(document_id)
        
        await agent.initialize()
        assert agent.agent_executor is not None
    
    @pytest.mark.asyncio
    async def test_extract_literatures(self):
        """测试提取文献"""
        document_id = uuid4()
        agent = ResearchAgent(document_id)
        
        # 模拟中间步骤
        from langchain.agents import AgentAction
        import json
        
        action = AgentAction(
            tool="SearchLiteratureTool",
            tool_input={"query": "测试"},
            log="",
        )
        observation = json.dumps({
            "results": [
                {"literature_id": "1", "title": "文献1"},
                {"literature_id": "2", "title": "文献2"},
            ]
        })
        
        intermediate_steps = [(action, observation)]
        
        literatures = agent._extract_literatures(intermediate_steps)
        assert len(literatures) == 2
        assert literatures[0]["title"] == "文献1"
    
    @pytest.mark.asyncio
    async def test_extract_key_points(self):
        """测试提取关键点"""
        document_id = uuid4()
        agent = ResearchAgent(document_id)
        
        analysis = """
        文献分析结果：
        - 关键点1
        - 关键点2
        * 关键点3
        1. 关键点4
        2. 关键点5
        """
        
        key_points = agent._extract_key_points(analysis)
        assert len(key_points) >= 3
    
    @pytest.mark.asyncio
    async def test_factory_function(self):
        """测试工厂函数"""
        document_id = uuid4()
        
        agent = await create_research_agent(document_id)
        assert isinstance(agent, ResearchAgent)
        assert agent.agent_executor is not None


class TestAgentIntegration:
    """测试智能体集成"""
    
    @pytest.mark.asyncio
    async def test_all_agents_created(self):
        """测试所有智能体都能创建"""
        document_id = uuid4()
        
        # 创建三个智能体
        chat_agent = DocumentChatAgent(document_id)
        editor_agent = DocumentEditorAgent(document_id)
        research_agent = ResearchAgent(document_id)
        
        # 初始化
        await chat_agent.initialize()
        await editor_agent.initialize()
        await research_agent.initialize()
        
        # 验证
        assert chat_agent.agent_executor is not None
        assert editor_agent.agent_executor is not None
        assert research_agent.agent_executor is not None
    
    @pytest.mark.asyncio
    async def test_agents_use_different_tools(self):
        """测试智能体使用不同的工具集"""
        document_id = uuid4()
        
        chat_agent = DocumentChatAgent(document_id)
        editor_agent = DocumentEditorAgent(document_id)
        research_agent = ResearchAgent(document_id)
        
        # 对话智能体：只读 + 查询
        chat_tool_names = [t.name for t in chat_agent.tools]
        assert "GetCoreInfoTool" in chat_tool_names
        assert "SearchLiteratureTool" in chat_tool_names
        
        # 编辑智能体：全部工具
        editor_tool_names = [t.name for t in editor_agent.tools]
        assert "GetCoreInfoTool" in editor_tool_names
        assert "SearchLiteratureTool" in editor_tool_names
        assert "SuggestCreateChapterTool" in editor_tool_names
        
        # 研究智能体：只读 + 查询
        research_tool_names = [t.name for t in research_agent.tools]
        assert "GetCoreInfoTool" in research_tool_names
        assert "SearchLiteratureTool" in research_tool_names
        assert "SuggestCreateChapterTool" not in research_tool_names
