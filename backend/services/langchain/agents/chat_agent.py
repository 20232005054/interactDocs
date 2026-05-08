"""
文档对话智能体

提供文档编辑助手功能，支持：
- 多轮对话
- 工具调用
- 建议生成
- 记忆管理

使用 LangGraph 实现
"""

import logging
import json
from typing import Any, AsyncIterator, Dict, List, Optional, Annotated, Sequence
from uuid import UUID

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from typing_extensions import TypedDict

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.memory_manager import create_memory_manager
from services.langchain.core.session_adapter import load_document_context
from services.langchain.tools import create_query_only_tools
from core.ai_prompts import SYSTEM_PROMPT_CHAT

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """Agent 状态"""
    messages: Annotated[Sequence[BaseMessage], "对话消息列表"]
    intermediate_steps: List[tuple]


class DocumentChatAgent:
    """
    文档对话智能体
    
    功能：
    - 回答文档相关问题
    - 提供编辑建议
    - 搜索文献
    - 验证实体
    
    使用 LangGraph 实现
    """
    
    def __init__(
        self,
        document_id: UUID,
        max_iterations: int = 5,
    ):
        """
        初始化
        
        Args:
            document_id: 文档 ID
            max_iterations: 最大迭代次数
        """
        self.document_id = document_id
        self.max_iterations = max_iterations
        
        # LLM
        self.llm = get_qwen_llm()
        
        # 记忆管理器
        self.memory = create_memory_manager(document_id)
        
        # 工具集（查询模式：只读 + 查询）
        self.tools = create_query_only_tools()
        
        # 绑定工具到 LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Graph
        self.graph = None
    
    async def initialize(self):
        """初始化 Agent（加载历史对话）"""
        from services.langchain.core.session_adapter import SessionAdapter
        
        # 加载历史对话
        async with SessionAdapter.query_session() as db:
            await self.memory.load_history(db, limit=10)
        
        # 创建 Graph
        workflow = StateGraph(AgentState)
        
        # 添加节点
        workflow.add_node("agent", self._call_model)
        workflow.add_node("tools", ToolNode(self.tools))
        
        # 设置入口
        workflow.set_entry_point("agent")
        
        # 添加条件边
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "tools",
                "end": END,
            }
        )
        
        # 工具执行后返回 agent
        workflow.add_edge("tools", "agent")
        
        # 编译
        self.graph = workflow.compile()
        
        logger.info(f"对话智能体初始化完成: document_id={self.document_id}")
    
    async def _call_model(self, state: AgentState) -> Dict:
        """调用模型"""
        messages = state["messages"]
        
        # 添加系统提示
        system_message = {"role": "system", "content": SYSTEM_PROMPT_CHAT}
        full_messages = [system_message] + list(messages)
        
        response = await self.llm_with_tools.ainvoke(full_messages)
        
        return {"messages": [response]}
    
    def _should_continue(self, state: AgentState) -> str:
        """判断是否继续"""
        messages = state["messages"]
        last_message = messages[-1]
        
        # 如果有工具调用，继续
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        
        # 否则结束
        return "end"
    
    async def chat(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        对话（非流式）
        
        Args:
            message: 用户消息
            context: 额外上下文
        
        Returns:
            响应字典 {response, actions, suggestions}
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        user_message = HumanMessage(content=message)
        
        # 执行 Graph
        try:
            result = await self.graph.ainvoke(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            )
            
            # 提取最后的 AI 消息
            messages = result.get("messages", [])
            response_text = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    response_text = msg.content
                    break
            
            # 提取 actions 和 suggestions
            actions, suggestions = self._parse_response(response_text)
            
            # 保存对话记录
            await self._save_chat_record(message, response_text)
            
            logger.info(
                f"对话完成: document_id={self.document_id} "
                f"actions={len(actions)} suggestions={len(suggestions)}"
            )
            
            return {
                "response": response_text,
                "actions": actions,
                "suggestions": suggestions,
            }
        
        except Exception as e:
            logger.error(f"对话失败: {e}")
            return {
                "response": f"对话失败：{str(e)}",
                "actions": [],
                "suggestions": [],
            }
    
    async def chat_stream(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """
        流式对话
        
        Args:
            message: 用户消息
            context: 额外上下文
        
        Yields:
            响应文本块
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        user_message = HumanMessage(content=message)
        
        # 流式执行
        full_response = ""
        
        try:
            async for event in self.graph.astream(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            ):
                # 提取 agent 节点的输出
                if "agent" in event:
                    messages = event["agent"].get("messages", [])
                    for msg in messages:
                        if isinstance(msg, AIMessage) and msg.content:
                            full_response += msg.content
                            yield msg.content
            
            # 保存对话记录
            await self._save_chat_record(message, full_response)
        
        except Exception as e:
            logger.error(f"流式对话失败: {e}")
            yield f"\n\n（对话失败：{str(e)}）"
    
    def _parse_response(self, response: str) -> tuple[List[Dict], List[Dict]]:
        """
        解析响应，提取 actions 和 suggestions
        
        Args:
            response: AI 响应
        
        Returns:
            (actions, suggestions)
        """
        actions = []
        suggestions = []
        
        # 解析 [ACTION]
        if "[ACTION]" in response:
            parts = response.split("[ACTION]")
            for i in range(1, len(parts)):
                action_str = parts[i].strip()
                try:
                    start = action_str.find("{")
                    if start == -1:
                        continue
                    
                    brace_count = 0
                    end = start
                    for j in range(start, len(action_str)):
                        if action_str[j] == "{":
                            brace_count += 1
                        elif action_str[j] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = j + 1
                                break
                    
                    if end > start:
                        action_json = json.loads(action_str[start:end])
                        actions.append(action_json)
                except json.JSONDecodeError:
                    continue
        
        # 解析 [SUGGESTION]
        if "[SUGGESTION]" in response:
            parts = response.split("[SUGGESTION]")
            for i in range(1, len(parts)):
                suggestion_str = parts[i].strip()
                try:
                    start = suggestion_str.find("{")
                    if start == -1:
                        continue
                    
                    brace_count = 0
                    end = start
                    for j in range(start, len(suggestion_str)):
                        if suggestion_str[j] == "{":
                            brace_count += 1
                        elif suggestion_str[j] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = j + 1
                                break
                    
                    if end > start:
                        suggestion_json = json.loads(suggestion_str[start:end])
                        if "type" in suggestion_json:
                            suggestions.append(suggestion_json)
                except json.JSONDecodeError:
                    continue
        
        return actions, suggestions
    
    async def _save_chat_record(self, message: str, response: str):
        """保存对话记录到数据库"""
        from services.langchain.core.session_adapter import SessionAdapter
        
        try:
            async with SessionAdapter.save_session() as db:
                await self.memory.save_to_db(db, message, response)
        except Exception as e:
            logger.error(f"保存对话记录失败: {e}")


async def create_chat_agent(document_id: UUID) -> DocumentChatAgent:
    """
    创建对话智能体
    
    Args:
        document_id: 文档 ID
    
    Returns:
        DocumentChatAgent 实例
    """
    agent = DocumentChatAgent(document_id)
    await agent.initialize()
    return agent
