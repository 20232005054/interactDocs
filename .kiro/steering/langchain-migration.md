---
title: LangChain 迁移指南
inclusion: manual
---

# LangChain 完全迁移项目

## 项目概述

将 InteractiveDocs 的 AI 层完全迁移到 LangChain 框架，构建可观测、可扩展、高性能的智能文档生成系统。

**总时长：** 20 周  
**总成本：** ¥500,000  
**团队规模：** 5 人  
**当前进度：** 3/12 阶段完成（25%）

---

## 快速开始（新会话）

如果你是新会话，请先了解：

1. **项目目标**：将现有 AI 功能迁移到 LangChain 框架
2. **当前状态**：已完成阶段 0-2（准备、核心组件、链开发）
3. **下一步**：阶段 3 - 工具系统开发
4. **重要规则**：
   - 每完成一个阶段自动 git commit
   - 不编写独立 MD 文档，写到 steering 里
   - 重要决策需先汇报并得到许可

**继续任务的命令：**
```
开始阶段3
```

---

## 迁移阶段

### ✅ 阶段 0：准备阶段（1 周）- 已完成

**完成时间：** 2026-05-08

**完成内容：**
1. ✅ 安装 LangChain 依赖包
   - langchain>=0.1.0
   - langchain-community>=0.2.0
   - langgraph>=0.0.20
   - langsmith>=0.1.0

2. ✅ 创建目录结构
   ```
   backend/services/langchain/
   ├── core/          # 核心组件
   ├── chains/        # 链定义
   ├── agents/        # 智能体
   ├── tools/         # 工具集
   ├── workflows/     # 工作流
   ├── prompts/       # Prompt 模板
   ├── retrievers/    # 检索器
   ├── callbacks/     # 回调处理器
   └── utils/         # 工具函数
   ```

3. ✅ 配置管理
   - `core/langchain_config.py` - LangChain 配置
   - `core/observability.py` - 可观测性配置
   - `.env` - 环境变量配置

4. ✅ Feature Flag 开关
   - `ENABLE_LANGCHAIN` - 总开关
   - `ENABLE_LANGCHAIN_RAG` - RAG 功能
   - `ENABLE_LANGCHAIN_CHAT` - 对话功能
   - `ENABLE_LANGCHAIN_PARAGRAPH` - 段落生成功能
   - `ENABLE_LANGCHAIN_WORKFLOW` - 工作流功能

**Git Commit：** feat(langchain): 完成阶段0 - 准备阶段

---

### ✅ 阶段 1：核心组件开发（2 周）- 已完成

**完成时间：** 2026-05-08

**完成内容：**
1. ✅ 实现 `QwenLLM` 适配器
   - 支持流式/非流式调用
   - 复用现有 dashscope 调用逻辑
   - 自动重试和错误处理
   - LLM 实例缓存

2. ✅ 实现 `LiteratureVectorStore`
   - 适配 LangChain VectorStore 接口
   - pgvector 后端支持
   - 相似度搜索（余弦距离）
   - 元数据过滤（literature_ids, section_type）
   - `QwenEmbeddings` 适配器

3. ✅ 实现三阶段 Session 适配器
   - `SessionAdapter` 核心类
   - 阶段1：`prepare_document_context()` - 预加载数据
   - 阶段2：`query_session()` - 临时查询
   - 阶段3：`save_session()` - 保存结果
   - 支持文档/章节/段落上下文加载

4. ✅ 实现 `MemoryManager`
   - 支持多种记忆类型（buffer_window, summary_buffer）
   - 从数据库加载历史对话
   - 自动摘要长对话
   - `EntityMemory` 实体追踪

5. ✅ 单元测试
   - `test_core.py` - 核心组件测试
   - 测试覆盖：LLM, Embeddings, SessionAdapter, MemoryManager

**Git Commit：** feat(langchain): 完成阶段1 - 核心组件开发

---

### ✅ 阶段 2：链开发（2 周）- 已完成

**完成时间：** 2026-05-08

**完成内容：**
1. ✅ 实现 `LiteratureRAGChain`
   - 两级检索策略（段落级 + 模板级）
   - 向量相似度搜索
   - 上下文格式化
   - LLM 重排序支持

2. ✅ 实现 `ParagraphGenerationChain`
   - 基于文档上下文生成段落
   - 支持流式/非流式生成
   - 自动提取文献引用
   - 支持用户修改意见

3. ✅ 实现 `SummaryGenerationChain`
   - 基于文档上下文生成摘要
   - 支持文献引用
   - 格式化核心信息

4. ✅ 实现 `QualityEvaluationChain`
   - 多维度评估（完整性/准确性/风格/引用）
   - 自动提取问题和建议
   - 支持流式评估
   - 结构化评估结果

5. ✅ 实现 `ContentRefinementChain`
   - 基于评估结果优化内容
   - 支持用户反馈
   - 支持流式优化
   - 迭代优化（直到达到目标分数）

6. ✅ 单元测试
   - `test_chains.py` - 链测试
   - 测试覆盖：RAG, Generation, Evaluation, Refinement

**Git Commit：** feat(langchain): 完成阶段2 - 链开发

---

### ✅ 阶段 3：工具系统开发（1 周）- 已完成

**完成时间：** 2026-05-08

**完成内容：**
1. ✅ 只读工具（document_tools.py）
   - `GetCoreInfoTool` - 获取核心信息（树形结构）
   - `GetSummariesTool` - 获取摘要列表
   - `GetChapterContentTool` - 获取章节内容

2. ✅ 查询工具（literature_tools.py）
   - `SearchLiteratureTool` - 搜索文献（临时 Session）
   - `ValidateEntityTool` - 验证实体存在性
   - `GetDependencyGraphTool` - 获取依赖图谱

3. ✅ 建议工具（suggestion_tools.py）
   - `SuggestCreateParagraphTool` - 建议创建段落
   - `SuggestEditContentTool` - 建议修改内容
   - `SuggestCreateChapterTool` - 建议创建章节
   - `SuggestInsertTextTool` - 建议插入文本

4. ✅ 工具调用追踪（tool_tracker.py）
   - `ToolCallTracker` - 追踪器类
   - `ToolCallRecord` - 调用记录
   - 统计信息（总调用数/成功率/平均时间）

5. ✅ 工具集合（__init__.py）
   - `create_all_tools()` - 创建所有工具
   - `create_readonly_only_tools()` - 只读模式
   - `create_query_only_tools()` - 查询模式

6. ✅ 单元测试（test_tools.py）
   - 测试所有工具的创建和运行
   - 测试工具追踪器
   - 测试建议格式解析

**Git Commit：** feat(langchain): 完成阶段3 - 工具系统开发

---

### 🔄 阶段 4：智能体开发（2 周）- 待开始

**目标：** 开发智能体系统

**任务清单：**
- [ ] DocumentChatAgent（对话智能体）
- [ ] DocumentEditorAgent（编辑智能体）
- [ ] ResearchAgent（文献研究智能体）
- [ ] 流式输出适配
- [ ] 智能体测试

---

### 阶段 4-12：待开发

**阶段 4：智能体开发（2 周）**
- DocumentChatAgent（对话智能体）
- DocumentEditorAgent（编辑智能体）
- ResearchAgent（文献研究智能体）

**阶段 5：工作流开发（2 周）**
- ChapterCompletionWorkflow（章节完善）
- DocumentGenerationWorkflow（文档生成）
- ContentReviewWorkflow（内容审核）

**阶段 6：服务层迁移（2 周）**
- ai_service_v2.py
- ai_chat_service_v2.py
- literature_rag_service_v2.py
- template_apply_service_v2.py

**阶段 7：API 切换（1 周）**
- Feature Flag 动态切换
- API 路由更新
- 降级方案

**阶段 8：测试优化（2 周）**
- 单元测试（覆盖率 > 80%）
- 性能测试
- A/B 测试

**阶段 9：可观测性（1 周）**
- LangSmith 集成
- 指标收集
- 告警系统

**阶段 10：文档培训（1 周）**
- 技术文档
- 用户文档
- 团队培训

**阶段 11：灰度发布（2 周）**
- 5% → 20% → 50% → 100%
- 监控指标
- 快速响应

**阶段 12：代码清理（1 周）**
- 删除旧代码
- 重命名文件
- 最终验证

---

## 已完成功能清单

### 核心组件（阶段 1）
- ✅ `QwenLLM` - 通义千问 LLM 适配器
  - 支持流式/非流式调用
  - 自动重试机制（3 次 + 指数退避）
  - 全局并发控制（Semaphore）
  - LLM 实例缓存
  
- ✅ `LiteratureVectorStore` - 向量存储
  - pgvector 后端支持
  - 余弦相似度搜索
  - 元数据过滤
  - `QwenEmbeddings` 适配器
  
- ✅ `SessionAdapter` - 三阶段 Session 管理
  - 阶段1：`prepare_document_context()` - 预加载数据
  - 阶段2：`query_session()` - 临时查询
  - 阶段3：`save_session()` - 保存结果
  - 支持文档/章节/段落三级上下文
  
- ✅ `MemoryManager` - 记忆管理
  - buffer_window（滑动窗口）
  - summary_buffer（自动摘要）
  - 从数据库加载历史
  - `EntityMemory` 实体追踪

### 链系统（阶段 2）
- ✅ `LiteratureRAGChain` - 文献检索链
  - 两级检索策略（段落级 + 模板级）
  - 向量相似度搜索
  - 上下文格式化
  - LLM 重排序支持
  
- ✅ `ParagraphGenerationChain` - 段落生成链
  - 基于文档上下文生成
  - 支持流式/非流式
  - 自动提取文献引用
  - 支持用户修改意见
  
- ✅ `SummaryGenerationChain` - 摘要生成链
  - 基于文档上下文生成
  - 支持文献引用
  - 格式化核心信息
  
- ✅ `QualityEvaluationChain` - 质量评估链
  - 多维度评估（完整性/准确性/风格/引用）
  - 自动提取问题和建议
  - 支持流式评估
  - 结构化评估结果
  
- ✅ `ContentRefinementChain` - 内容优化链
  - 基于评估结果优化
  - 支持用户反馈
  - 支持流式优化
  - 迭代优化（直到达到目标分数）

### 工具系统（阶段 3）
- ✅ 只读工具（3 个）
  - GetCoreInfoTool - 获取核心信息
  - GetSummariesTool - 获取摘要
  - GetChapterContentTool - 获取章节内容
  
- ✅ 查询工具（3 个）
  - SearchLiteratureTool - 搜索文献
  - ValidateEntityTool - 验证实体
  - GetDependencyGraphTool - 获取依赖图谱
  
- ✅ 建议工具（4 个）
  - SuggestCreateParagraphTool - 建议创建段落
  - SuggestEditContentTool - 建议修改内容
  - SuggestCreateChapterTool - 建议创建章节
  - SuggestInsertTextTool - 建议插入文本
  
- ✅ 工具追踪器
  - ToolCallTracker - 调用追踪
  - ToolCallRecord - 调用记录
  - 统计信息收集

---

## 技术架构

### 目录结构
```
backend/services/langchain/
├── core/                    # 核心组件
│   ├── llm_factory.py       # LLM 工厂
│   ├── vector_stores.py     # 向量存储
│   ├── session_adapter.py   # Session 适配器
│   └── memory_manager.py    # 记忆管理
├── chains/                  # 链定义
│   ├── rag_chain.py         # RAG 检索链
│   ├── generation_chain.py  # 内容生成链
│   ├── evaluation_chain.py  # 质量评估链
│   └── refinement_chain.py  # 内容优化链
├── agents/                  # 智能体（待开发）
├── tools/                   # 工具集（待开发）
├── workflows/               # 工作流（待开发）
├── prompts/                 # Prompt 模板
├── retrievers/              # 检索器
├── callbacks/               # 回调处理器
└── utils/                   # 工具函数
```

### 配置文件
- `core/langchain_config.py` - LangChain 配置
- `core/observability.py` - 可观测性配置
- `.env` - 环境变量配置

---

## 配置说明

### 环境变量

```bash
# LangChain 总开关
ENABLE_LANGCHAIN=false

# 功能级开关
ENABLE_LANGCHAIN_RAG=false
ENABLE_LANGCHAIN_CHAT=false
ENABLE_LANGCHAIN_PARAGRAPH=false
ENABLE_LANGCHAIN_WORKFLOW=false

# LangSmith 可观测性
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=interactive-docs

# LLM 配置
LANGCHAIN_LLM_MODEL=qwen-max
LANGCHAIN_LLM_TEMPERATURE=0.7
LANGCHAIN_LLM_MAX_TOKENS=2000
```

### 使用方式

```python
from core.langchain_config import is_langchain_enabled

# 检查总开关
if is_langchain_enabled():
    # 使用 LangChain 实现
    pass
else:
    # 使用原生实现
    pass

# 检查功能开关
if is_langchain_enabled("rag"):
    # 使用 LangChain RAG
    pass
```

---

## 开发规范

### Git Commit 规范

每完成一个阶段自动提交：
```
feat(langchain): 完成阶段X - [阶段名称]

详细变更说明：
- 变更1
- 变更2
```

### 文档规范

- ✅ 架构决策和开发日志写入 `.kiro/steering/`
- ✅ 重要决策需先汇报并得到许可
- ❌ 不编写独立的 MD 文档

---

## 下一步

开始阶段 3：工具系统开发

**任务概述：**
1. 实现只读工具（从预加载上下文读取）
2. 实现查询工具（临时 Session 查询）
3. 实现写入工具（返回建议，不直接执行）
4. 实现工具调用追踪
5. 编写工具测试

**预计时间：** 1 周

**命令：**
```
开始阶段3
```
