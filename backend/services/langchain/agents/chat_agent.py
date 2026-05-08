"""
文档对话智能体

提供文档编辑助手功能，支持：
- 多轮对话
- 工具调用
- 建议生成
- 记忆管理
"""

import logging
import json
from typing import Any, AsyncIterator, Dict, List, Optional
from uuid import UUID

from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.runnables import RunnableConfig

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.memory_manager import create_memory_manager
from services.langchain.core.session_adapter import load_document_context
from services.langchain.tools import create_query_only_tools
from core.ai_prompts import SYSTEM_PROMPT_CHAT

logger = logging.getLogger(__name__)


class DocumentChatAgent:
    """
    文档对话智能体
    
    功能：
    - 回答文档相关问题
    - 提供编辑建议
    - 搜索文献
    - 验证实体
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
        
        # Agent 执行器
        self.agent_executor = None
    
    async def initialize(self):
        """初始化 Agent（加载历史对话）"""
        from services.langchain.core.session_adapter import SessionAdapter
        
        # 加载历史对话
        async with SessionAdapter.query_session() as db:
            await self.memory.load_history(db, limit=10)
        
        # 创建 Prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_CHAT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # 创建 Agent
        # 注意：通义千问不支持 OpenAI Functions，这里使用简化版本
        # 实际应该使用 create_react_agent 或自定义 Agent
        from langchain.agents import create_react_agent
        
        agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt,
        )
        
        # 创建执行器
        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory.memory,
            verbose=True,
            max_iterations=self.max_iterations,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )
        
        logger.info(f"对话智能体初始化完成: document_id={self.document_id}")
    
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
            响应字典 {response, actions, suggestions, intermediate_steps}
        """
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_data = {
            "input": message,
        }
        
        # 如果有上下文，添加到输入
        if context:
            input_data["context"] = context
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            response_text = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
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
                "intermediate_steps": intermediate_steps,
            }
        
        except Exception as e:
            logger.error(f"对话失败: {e}")
            return {
                "response": f"对话失败：{str(e)}",
                "actions": [],
                "suggestions": [],
                "intermediate_steps": [],
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
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_data = {
            "input": message,
        }
        
        if context:
            input_data["context"] = context
        
        # 流式执行
        full_response = ""
        
        try:
            async for chunk in self.agent_executor.astream(input_data):
                # 提取输出
                if "output" in chunk:
                    text = chunk["output"]
                    full_response += text
                    yield text
                
                # 提取中间步骤
                elif "intermediate_steps" in chunk:
                    steps = chunk["intermediate_steps"]
                    logger.debug(f"中间步骤: {steps}")
            
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
