"""
文献研究智能体

提供文献研究助手功能，支持：
- 文献检索
- 文献分析
- 引用建议
- 知识图谱
"""

import logging
import json
from typing import Any, AsyncIterator, Dict, List, Optional
from uuid import UUID

from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.tools.literature_tools import create_query_tools
from services.langchain.tools.document_tools import create_readonly_tools
from core.ai_prompts import BASE_EXPERT_ROLE, LITERATURE_CITATION_RULES

logger = logging.getLogger(__name__)


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
        
        # Agent 执行器
        self.agent_executor = None
    
    async def initialize(self):
        """初始化 Agent"""
        # 创建 Prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", RESEARCH_SYSTEM_PROMPT),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # 创建 Agent
        agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt,
        )
        
        # 创建执行器
        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            max_iterations=self.max_iterations,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )
        
        logger.info(f"研究智能体初始化完成: document_id={self.document_id}")
    
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
            检索结果 {summary, literatures, intermediate_steps}
        """
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_text = f"请检索关于「{query}」的相关文献。"
        if filters:
            input_text += f"\n过滤条件：{json.dumps(filters, ensure_ascii=False)}"
        
        input_data = {"input": input_text}
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            summary = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
            # 提取文献列表
            literatures = self._extract_literatures(intermediate_steps)
            
            logger.info(
                f"文献检索完成: query={query} "
                f"literatures={len(literatures)}"
            )
            
            return {
                "summary": summary,
                "literatures": literatures,
                "intermediate_steps": intermediate_steps,
            }
        
        except Exception as e:
            logger.error(f"文献检索失败: {e}")
            return {
                "summary": f"检索失败：{str(e)}",
                "literatures": [],
                "intermediate_steps": [],
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
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_data = {
            "input": f"请分析文献 {literature_id}，提取关键信息和核心观点。",
        }
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            analysis = result.get("output", "")
            
            # 提取关键点
            key_points = self._extract_key_points(analysis)
            
            logger.info(f"文献分析完成: literature_id={literature_id}")
            
            return {
                "analysis": analysis,
                "key_points": key_points,
                "citations": [],  # TODO: 提取引用建议
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
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_text = f"请为以下内容建议合适的文献引用：\n\n{content}"
        if context:
            input_text += f"\n\n上下文：{context}"
        
        input_data = {"input": input_text}
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            suggestions_text = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
            # 提取文献
            literatures = self._extract_literatures(intermediate_steps)
            
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
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_data = {
            "input": (
                f"请构建关于「{topic}」的知识图谱，"
                "包括相关概念、文献、依赖关系。"
            ),
        }
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            graph_text = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
            # 提取图谱数据
            nodes, edges = self._extract_graph_data(intermediate_steps)
            
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
    
    def _extract_literatures(self, intermediate_steps: List) -> List[Dict]:
        """从中间步骤中提取文献列表"""
        literatures = []
        
        for step in intermediate_steps:
            if len(step) < 2:
                continue
            
            action, observation = step
            
            # 检查是否是 SearchLiteratureTool
            if action.tool == "SearchLiteratureTool":
                try:
                    # observation 是工具返回的 JSON 字符串
                    if isinstance(observation, str):
                        data = json.loads(observation)
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
    
    def _extract_graph_data(self, intermediate_steps: List) -> tuple[List[Dict], List[Dict]]:
        """从中间步骤中提取图谱数据"""
        nodes = []
        edges = []
        
        for step in intermediate_steps:
            if len(step) < 2:
                continue
            
            action, observation = step
            
            # 检查是否是 GetDependencyGraphTool
            if action.tool == "GetDependencyGraphTool":
                try:
                    if isinstance(observation, str):
                        data = json.loads(observation)
                        if "nodes" in data:
                            nodes.extend(data["nodes"])
                        if "edges" in data:
                            edges.extend(data["edges"])
                except (json.JSONDecodeError, KeyError):
                    continue
        
        return nodes, edges


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
