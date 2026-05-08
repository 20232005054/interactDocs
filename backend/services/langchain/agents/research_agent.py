"""
文献研究智能体

提供文献研究助手功能，支持：
- 文献检索
- 文献分析
- 引用建议
- 知识图谱

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
from typing_extensions import TypedDict

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.tools.literature_tools import create_query_tools
from services.langchain.tools.document_tools import create_readonly_tools
from core.ai_prompts import BASE_EXPERT_ROLE, LITERATURE_CITATION_RULES

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """Agent 状态"""
    messages: Annotated[Sequence[BaseMessage], "对话消息列表"]
    intermediate_steps: List[tuple]


# Research Agent System Prompt
RESEARCH_SYSTEM_PROMPT = f"""{BASE_EXPERT_ROLE}你是一个文献研究助手，负责帮助用户检索和分析文献。

**你的职责**：
1. 根据用户需求检索相关文献
2. 分析文献内容，提取关键信息
3. 提供引用建议
4. 构建知识图谱

**可用工具**：
- GetCoreInfoTool：获取文档核心信息（了解研究背景）
- GetSummariesTool：获取文档摘要（了解研究方向）
- SearchLiteratureTool：搜索文献（主要工具）
- ValidateEntityTool：验证实体存在性
- GetDependencyGraphTool：获取依赖关系

**工作流程**：
1. 理解用户的研究需求
2. 使用 SearchLiteratureTool 检索相关文献
3. 分析文献内容，提取关键信息
4. 提供引用建议和知识图谱

**注意事项**：
- 优先使用文档已有的文献
- 引用文献时使用 [编号] 格式
- 提供文献的关键信息（标题、作者、年份、核心观点）
- 不要编造文献

{LITERATURE_CITATION_RULES}
"""


class ResearchAgent:
    """
    文献研究智能体
    
    功能：
    - 文献检索
    - 文献分析
    - 引用建议
    
    使用 LangGraph 实现
    """
    
    def __init__(
        self,
        document_id: UUID,
        max_iterations: int = 8,
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
        
        # 工具集（只读 + 查询）
        self.tools = []
        self.tools.extend(create_readonly_tools())
        self.tools.extend(create_query_tools())
        
        # 绑定工具到 LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Graph
        self.graph = None
    
    async def initialize(self):
        """初始化 Agent"""
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
        
        logger.info(f"研究智能体初始化完成: document_id={self.document_id}")
    
    async def _call_model(self, state: AgentState) -> Dict:
        """调用模型"""
        messages = state["messages"]
        
        # 添加系统提示
        system_message = {"role": "system", "content": RESEARCH_SYSTEM_PROMPT}
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
    
    async def search_literature(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        检索文献
        
        Args:
            query: 检索查询
            filters: 过滤条件
        
        Returns:
            检索结果 {summary, literatures}
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        input_text = f"请检索关于「{query}」的相关文献。"
        if filters:
            input_text += f"\n过滤条件：{json.dumps(filters, ensure_ascii=False)}"
        
        user_message = HumanMessage(content=input_text)
        
        # 执行 Graph
        try:
            result = await self.graph.ainvoke(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            )
            
            # 提取最后的 AI 消息
            messages = result.get("messages", [])
            summary = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    summary = msg.content
                    break
            
            # 提取文献列表
            literatures = self._extract_literatures_from_messages(messages)
            
            logger.info(
                f"文献检索完成: query={query} "
                f"literatures={len(literatures)}"
            )
            
            return {
                "summary": summary,
                "literatures": literatures,
            }
        
        except Exception as e:
            logger.error(f"文献检索失败: {e}")
            return {
                "summary": f"检索失败：{str(e)}",
                "literatures": [],
            }
    
    async def analyze_literature(
        self,
        literature_id: UUID,
    ) -> Dict[str, Any]:
        """
        分析文献
        
        Args:
            literature_id: 文献 ID
        
        Returns:
            分析结果 {analysis, key_points, citations}
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        user_message = HumanMessage(
            content=f"请分析文献 {literature_id}，提取关键信息和核心观点。"
        )
        
        # 执行 Graph
        try:
            result = await self.graph.ainvoke(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            )
            
            # 提取最后的 AI 消息
            messages = result.get("messages", [])
            analysis = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    analysis = msg.content
                    break
            
            # 提取关键点
            key_points = self._extract_key_points(analysis)
            
            # 提取引用建议
            citations = self._extract_citations_from_analysis(analysis)
            
            logger.info(
                f"文献分析完成: literature_id={literature_id} "
                f"citations={len(citations)}"
            )
            
            return {
                "analysis": analysis,
                "key_points": key_points,
                "citations": citations,
            }
        
        except Exception as e:
            logger.error(f"文献分析失败: {e}")
            return {
                "analysis": f"分析失败：{str(e)}",
                "key_points": [],
                "citations": [],
            }
    
    async def suggest_citations(
        self,
        content: str,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        建议引用
        
        Args:
            content: 内容文本
            context: 上下文
        
        Returns:
            引用建议 {suggestions, literatures}
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        input_text = f"请为以下内容建议合适的文献引用：\n\n{content}"
        if context:
            input_text += f"\n\n上下文：{context}"
        
        user_message = HumanMessage(content=input_text)
        
        # 执行 Graph
        try:
            result = await self.graph.ainvoke(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            )
            
            # 提取最后的 AI 消息
            messages = result.get("messages", [])
            suggestions_text = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    suggestions_text = msg.content
                    break
            
            # 提取文献
            literatures = self._extract_literatures_from_messages(messages)
            
            logger.info(f"引用建议完成: literatures={len(literatures)}")
            
            return {
                "suggestions": suggestions_text,
                "literatures": literatures,
            }
        
        except Exception as e:
            logger.error(f"引用建议失败: {e}")
            return {
                "suggestions": f"建议失败：{str(e)}",
                "literatures": [],
            }
    
    async def build_knowledge_graph(
        self,
        topic: str,
    ) -> Dict[str, Any]:
        """
        构建知识图谱
        
        Args:
            topic: 主题
        
        Returns:
            知识图谱 {graph, nodes, edges}
        """
        if not self.graph:
            await self.initialize()
        
        # 准备输入
        user_message = HumanMessage(
            content=f"请构建关于「{topic}」的知识图谱，"
                    "包括相关概念、文献、依赖关系。"
        )
        
        # 执行 Graph
        try:
            result = await self.graph.ainvoke(
                {"messages": [user_message], "intermediate_steps": []},
                config={"recursion_limit": self.max_iterations}
            )
            
            # 提取最后的 AI 消息
            messages = result.get("messages", [])
            graph_text = ""
            for msg in reversed(messages):
                if isinstance(msg, AIMessage):
                    graph_text = msg.content
                    break
            
            # 提取图谱数据
            nodes, edges = self._extract_graph_data_from_messages(messages)
            
            logger.info(
                f"知识图谱构建完成: topic={topic} "
                f"nodes={len(nodes)} edges={len(edges)}"
            )
            
            return {
                "graph": graph_text,
                "nodes": nodes,
                "edges": edges,
            }
        
        except Exception as e:
            logger.error(f"知识图谱构建失败: {e}")
            return {
                "graph": f"构建失败：{str(e)}",
                "nodes": [],
                "edges": [],
            }
    
    def _extract_literatures_from_messages(self, messages: List[BaseMessage]) -> List[Dict]:
        """从消息列表中提取文献列表"""
        literatures = []
        
        for msg in messages:
            if isinstance(msg, ToolMessage):
                try:
                    # observation 是工具返回的 JSON 字符串
                    if isinstance(msg.content, str):
                        data = json.loads(msg.content)
                        if "results" in data:
                            literatures.extend(data["results"])
                except (json.JSONDecodeError, KeyError):
                    continue
        
        return literatures
    
    def _extract_key_points(self, analysis: str) -> List[str]:
        """从分析文本中提取关键点"""
        key_points = []
        
        # 简单的关键点提取（按行分割）
        lines = analysis.split("\n")
        for line in lines:
            line = line.strip()
            # 提取以 - 或 * 开头的列表项
            if line.startswith("-") or line.startswith("*"):
                key_points.append(line[1:].strip())
            # 提取以数字开头的列表项
            elif line and line[0].isdigit() and "." in line[:3]:
                key_points.append(line.split(".", 1)[1].strip())
        
        return key_points
    
    def _extract_graph_data_from_messages(self, messages: List[BaseMessage]) -> tuple[List[Dict], List[Dict]]:
        """从消息列表中提取图谱数据"""
        nodes = []
        edges = []
        
        for msg in messages:
            if isinstance(msg, ToolMessage):
                try:
                    if isinstance(msg.content, str):
                        data = json.loads(msg.content)
                        if "nodes" in data:
                            nodes.extend(data["nodes"])
                        if "edges" in data:
                            edges.extend(data["edges"])
                except (json.JSONDecodeError, KeyError):
                    continue
        
        return nodes, edges
    
    def _extract_citations_from_analysis(self, analysis: str) -> List[Dict]:
        """
        从分析文本中提取引用建议
        
        提取格式：[编号] 标题 - 作者 (年份)
        
        Args:
            analysis: 分析文本
        
        Returns:
            引用列表 [{number, title, authors, year, reason}]
        """
        import re
        
        citations = []
        
        # 匹配 [数字] 格式的引用
        pattern = r'\[(\d+)\]\s*([^\n\-]+?)(?:\s*-\s*([^\n\(]+?))?(?:\s*\((\d{4})\))?'
        matches = re.finditer(pattern, analysis)
        
        for match in matches:
            number = int(match.group(1))
            title = match.group(2).strip() if match.group(2) else ""
            authors = match.group(3).strip() if match.group(3) else ""
            year = match.group(4) if match.group(4) else ""
            
            # 提取引用原因（引用后的文本）
            reason = ""
            end_pos = match.end()
            next_newline = analysis.find("\n", end_pos)
            if next_newline != -1:
                reason = analysis[end_pos:next_newline].strip()
            
            if title:  # 至少要有标题
                citations.append({
                    "number": number,
                    "title": title,
                    "authors": authors,
                    "year": year,
                    "reason": reason,
                })
        
        logger.info(f"从分析中提取了 {len(citations)} 条引用建议")
        return citations


async def create_research_agent(document_id: UUID) -> ResearchAgent:
    """
    创建研究智能体
    
    Args:
        document_id: 文档 ID
    
    Returns:
        ResearchAgent 实例
    """
    agent = ResearchAgent(document_id)
    await agent.initialize()
    return agent
