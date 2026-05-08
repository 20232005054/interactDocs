"""
文档编辑智能体

提供自动化文档编辑功能，支持：
- 自动创建章节
- 自动生成段落
- 自动优化内容
- 需要用户确认
"""

import logging
import json
from typing import Any, AsyncIterator, Dict, List, Optional
from uuid import UUID

from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from services.langchain.core.llm_factory import get_qwen_llm
from services.langchain.core.session_adapter import load_document_context
from services.langchain.tools import create_all_tools
from core.ai_prompts import BASE_EXPERT_ROLE, LITERATURE_CITATION_RULES

logger = logging.getLogger(__name__)


# Editor Agent System Prompt
EDITOR_SYSTEM_PROMPT = f"""{BASE_EXPERT_ROLE}你是一个文档编辑助手，负责自动化完善文档内容。

**你的职责**：
1. 分析文档结构，识别缺失或不完整的部分
2. 使用工具生成编辑建议（创建章节、生成段落、修改内容）
3. 所有建议都需要用户确认后才会执行

**可用工具**：
- GetCoreInfoTool：获取文档核心信息
- GetSummariesTool：获取文档摘要
- GetChapterContentTool：获取章节内容
- SearchLiteratureTool：搜索相关文献
- ValidateEntityTool：验证实体存在性
- GetDependencyGraphTool：获取依赖关系
- SuggestCreateChapterTool：建议创建章节
- SuggestCreateParagraphTool：建议创建段落
- SuggestEditContentTool：建议修改内容
- SuggestInsertTextTool：建议插入文本

**工作流程**：
1. 使用只读工具了解文档当前状态
2. 分析缺失或需要改进的部分
3. 使用建议工具生成编辑建议
4. 返回建议列表给用户确认

{LITERATURE_CITATION_RULES}
"""


class DocumentEditorAgent:
    """
    文档编辑智能体
    
    功能：
    - 自动分析文档结构
    - 生成编辑建议
    - 批量处理编辑任务
    """
    
    def __init__(
        self,
        document_id: UUID,
        max_iterations: int = 10,
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
        
        # 工具集（全部工具：只读 + 查询 + 建议）
        self.tools = create_all_tools()
        
        # Agent 执行器
        self.agent_executor = None
    
    async def initialize(self):
        """初始化 Agent"""
        # 创建 Prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", EDITOR_SYSTEM_PROMPT),
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
        
        logger.info(f"编辑智能体初始化完成: document_id={self.document_id}")
    
    async def analyze_document(self) -> Dict[str, Any]:
        """
        分析文档，生成改进建议
        
        Returns:
            分析结果 {analysis, suggestions, intermediate_steps}
        """
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_data = {
            "input": (
                f"请分析文档 {self.document_id} 的结构和内容，"
                "识别缺失或不完整的部分，并生成改进建议。"
            ),
        }
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            analysis = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
            # 提取建议
            suggestions = self._extract_suggestions(intermediate_steps)
            
            logger.info(
                f"文档分析完成: document_id={self.document_id} "
                f"suggestions={len(suggestions)}"
            )
            
            return {
                "analysis": analysis,
                "suggestions": suggestions,
                "intermediate_steps": intermediate_steps,
            }
        
        except Exception as e:
            logger.error(f"文档分析失败: {e}")
            return {
                "analysis": f"分析失败：{str(e)}",
                "suggestions": [],
                "intermediate_steps": [],
            }
    
    async def complete_chapter(
        self,
        chapter_id: UUID,
        requirements: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        完善章节内容
        
        Args:
            chapter_id: 章节 ID
            requirements: 用户要求
        
        Returns:
            完善结果 {result, suggestions, intermediate_steps}
        """
        if not self.agent_executor:
            await self.initialize()
        
        # 准备输入
        input_text = f"请完善章节 {chapter_id} 的内容。"
        if requirements:
            input_text += f"\n用户要求：{requirements}"
        
        input_data = {"input": input_text}
        
        # 执行 Agent
        try:
            result = await self.agent_executor.ainvoke(input_data)
            
            # 解析响应
            result_text = result.get("output", "")
            intermediate_steps = result.get("intermediate_steps", [])
            
            # 提取建议
            suggestions = self._extract_suggestions(intermediate_steps)
            
            logger.info(
                f"章节完善完成: chapter_id={chapter_id} "
                f"suggestions={len(suggestions)}"
            )
            
            return {
                "result": result_text,
                "suggestions": suggestions,
                "intermediate_steps": intermediate_steps,
            }
        
        except Exception as e:
            logger.error(f"章节完善失败: {e}")
            return {
                "result": f"完善失败：{str(e)}",
                "suggestions": [],
                "intermediate_steps": [],
            }
    
    async def batch_edit(
        self,
        tasks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        批量编辑任务
        
        Args:
            tasks: 任务列表 [{"type": "create_chapter", "data": {...}}, ...]
        
        Returns:
            结果列表
        """
        if not self.agent_executor:
            await self.initialize()
        
        results = []
        
        for task in tasks:
            task_type = task.get("type")
            task_data = task.get("data", {})
            
            # 构建任务描述
            if task_type == "create_chapter":
                input_text = (
                    f"创建章节：标题={task_data.get('title')}, "
                    f"父章节={task_data.get('parent_id')}"
                )
            elif task_type == "create_paragraph":
                input_text = (
                    f"创建段落：章节={task_data.get('chapter_id')}, "
                    f"类型={task_data.get('para_type')}"
                )
            elif task_type == "edit_content":
                input_text = (
                    f"修改内容：目标={task_data.get('target_type')} "
                    f"{task_data.get('target_id')}"
                )
            else:
                results.append({
                    "task": task,
                    "success": False,
                    "error": f"未知任务类型: {task_type}",
                })
                continue
            
            # 执行任务
            try:
                result = await self.agent_executor.ainvoke({"input": input_text})
                
                results.append({
                    "task": task,
                    "success": True,
                    "result": result.get("output", ""),
                })
            
            except Exception as e:
                logger.error(f"批量编辑任务失败: {e}")
                results.append({
                    "task": task,
                    "success": False,
                    "error": str(e),
                })
        
        logger.info(f"批量编辑完成: 总任务={len(tasks)}, 成功={sum(1 for r in results if r.get('success'))}")
        
        return results
    
    def _extract_suggestions(self, intermediate_steps: List) -> List[Dict]:
        """
        从中间步骤中提取建议
        
        Args:
            intermediate_steps: Agent 中间步骤
        
        Returns:
            建议列表
        """
        suggestions = []
        
        for step in intermediate_steps:
            # step 格式: (AgentAction, observation)
            if len(step) < 2:
                continue
            
            action, observation = step
            
            # 检查是否是建议工具
            if action.tool.startswith("Suggest"):
                try:
                    # observation 是工具返回的 [SUGGESTION] 字符串
                    if "[SUGGESTION]" in observation:
                        suggestion_str = observation.split("[SUGGESTION]")[1].strip()
                        
                        # 提取 JSON
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
                            suggestions.append(suggestion_json)
                
                except (json.JSONDecodeError, IndexError):
                    continue
        
        return suggestions


async def create_editor_agent(document_id: UUID) -> DocumentEditorAgent:
    """
    创建编辑智能体
    
    Args:
        document_id: 文档 ID
    
    Returns:
        DocumentEditorAgent 实例
    """
    agent = DocumentEditorAgent(document_id)
    await agent.initialize()
    return agent
