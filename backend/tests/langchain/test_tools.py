"""
工具测试

测试文档工具、文献工具、建议工具、工具追踪器
"""

import pytest
import json
from uuid import uuid4

from services.langchain.tools import (
    create_all_tools,
    create_readonly_only_tools,
    create_query_only_tools,
    get_tracker,
)
from services.langchain.tools.document_tools import (
    GetCoreInfoTool,
    GetSummariesTool,
    GetChapterContentTool,
)
from services.langchain.tools.literature_tools import (
    SearchLiteratureTool,
    ValidateEntityTool,
    GetDependencyGraphTool,
)
from services.langchain.tools.suggestion_tools import (
    SuggestCreateParagraphTool,
    SuggestEditContentTool,
    SuggestCreateChapterTool,
    SuggestInsertTextTool,
)
from services.langchain.tools.tool_tracker import ToolCallTracker, ToolCallRecord


class TestDocumentTools:
    """测试文档工具"""
    
    def test_get_core_info_tool(self):
        """测试获取核心信息工具"""
        tool = GetCoreInfoTool()
        assert tool.name == "get_core_info"
        assert tool.description is not None
    
    @pytest.mark.asyncio
    async def test_get_core_info_run(self):
        """测试运行获取核心信息"""
        tool = GetCoreInfoTool()
        
        context = {
            "core_info": [
                {
                    "core_info_id": "1",
                    "parent_id": None,
                    "title": "试验名称",
                    "content": "测试试验",
                    "field_type": "text",
                },
                {
                    "core_info_id": "2",
                    "parent_id": None,
                    "title": "试验目的",
                    "content": "",
                    "field_type": "group",
                },
                {
                    "core_info_id": "3",
                    "parent_id": "2",
                    "title": "主要目的",
                    "content": "测试主要目的",
                    "field_type": "text",
                },
            ]
        }
        
        result = await tool._arun(context=context)
        assert "试验名称" in result
        assert "测试试验" in result
        assert "主要目的" in result
    
    def test_get_summaries_tool(self):
        """测试获取摘要工具"""
        tool = GetSummariesTool()
        assert tool.name == "get_summaries"
    
    def test_get_chapter_content_tool(self):
        """测试获取章节内容工具"""
        tool = GetChapterContentTool()
        assert tool.name == "get_chapter_content"


class TestLiteratureTools:
    """测试文献工具"""
    
    def test_search_literature_tool(self):
        """测试搜索文献工具"""
        tool = SearchLiteratureTool()
        assert tool.name == "search_literature"
    
    @pytest.mark.asyncio
    async def test_search_literature_run(self):
        """测试运行搜索文献"""
        # 跳过，需要数据库
        pytest.skip("需要数据库")
    
    def test_validate_entity_tool(self):
        """测试验证实体工具"""
        tool = ValidateEntityTool()
        assert tool.name == "validate_entity"
    
    def test_get_dependency_graph_tool(self):
        """测试获取依赖图谱工具"""
        tool = GetDependencyGraphTool()
        assert tool.name == "get_dependency_graph"


class TestSuggestionTools:
    """测试建议工具"""
    
    @pytest.mark.asyncio
    async def test_suggest_create_paragraph(self):
        """测试建议创建段落"""
        tool = SuggestCreateParagraphTool()
        
        result = await tool._arun(
            chapter_id="test-chapter-id",
            content="测试段落内容",
            para_type="paragraph",
            description="测试说明",
        )
        
        assert "[SUGGESTION]" in result
        assert "create_paragraph" in result
        
        # 解析 JSON
        json_str = result.replace("[SUGGESTION]", "")
        suggestion = json.loads(json_str)
        
        assert suggestion["type"] == "create_paragraph"
        assert suggestion["chapter_id"] == "test-chapter-id"
        assert suggestion["content"] == "测试段落内容"
    
    @pytest.mark.asyncio
    async def test_suggest_edit_content(self):
        """测试建议修改内容"""
        tool = SuggestEditContentTool()
        
        result = await tool._arun(
            target_type="paragraph",
            target_id="test-id",
            original_content="原内容",
            suggested_content="新内容",
            reason="测试修改",
        )
        
        assert "[SUGGESTION]" in result
        assert "edit_content" in result
    
    @pytest.mark.asyncio
    async def test_suggest_create_chapter(self):
        """测试建议创建章节"""
        tool = SuggestCreateChapterTool()
        
        result = await tool._arun(
            title="测试章节",
            parent_id=None,
            description="测试说明",
        )
        
        assert "[SUGGESTION]" in result
        assert "create_chapter" in result
    
    @pytest.mark.asyncio
    async def test_suggest_insert_text(self):
        """测试建议插入文本"""
        tool = SuggestInsertTextTool()
        
        result = await tool._arun(
            chapter_id="test-chapter-id",
            content="要插入的文本",
            position="end",
            description="测试说明",
        )
        
        assert "[SUGGESTION]" in result
        assert "insert_text" in result


class TestToolTracker:
    """测试工具追踪器"""
    
    def test_create_tracker(self):
        """测试创建追踪器"""
        tracker = ToolCallTracker()
        assert tracker is not None
        assert len(tracker.records) == 0
    
    def test_start_call(self):
        """测试开始调用"""
        tracker = ToolCallTracker()
        
        call_id = tracker.start_call(
            tool_name="test_tool",
            input_args={"arg1": "value1"},
        )
        
        assert call_id is not None
        assert len(tracker.records) == 1
        assert tracker.records[0].tool_name == "test_tool"
    
    def test_end_call(self):
        """测试结束调用"""
        tracker = ToolCallTracker()
        
        call_id = tracker.start_call("test_tool", {})
        tracker.end_call(
            call_id=call_id,
            output_result="test result",
            execution_time=0.5,
        )
        
        record = tracker.records[0]
        assert record.output_result == "test result"
        assert record.execution_time == 0.5
        assert record.error is None
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        tracker = ToolCallTracker()
        
        # 添加一些调用记录
        call_id1 = tracker.start_call("tool1", {})
        tracker.end_call(call_id1, "result1", 0.1)
        
        call_id2 = tracker.start_call("tool2", {})
        tracker.end_call(call_id2, "result2", 0.2, error="test error")
        
        stats = tracker.get_statistics()
        
        assert stats["total_calls"] == 2
        assert stats["success_calls"] == 1
        assert stats["failed_calls"] == 1
        assert stats["success_rate"] == 0.5
        assert "tool1" in stats["tool_stats"]
        assert "tool2" in stats["tool_stats"]


class TestToolCreation:
    """测试工具创建函数"""
    
    def test_create_all_tools(self):
        """测试创建所有工具"""
        tools = create_all_tools()
        assert len(tools) > 0
        
        # 检查工具类型
        tool_names = [t.name for t in tools]
        assert "get_core_info" in tool_names
        assert "search_literature" in tool_names
        assert "suggest_create_paragraph" in tool_names
    
    def test_create_readonly_only_tools(self):
        """测试创建只读工具"""
        tools = create_readonly_only_tools()
        assert len(tools) == 3
        
        tool_names = [t.name for t in tools]
        assert "get_core_info" in tool_names
        assert "get_summaries" in tool_names
        assert "get_chapter_content" in tool_names
    
    def test_create_query_only_tools(self):
        """测试创建查询工具"""
        tools = create_query_only_tools()
        assert len(tools) == 6  # 3 只读 + 3 查询


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
