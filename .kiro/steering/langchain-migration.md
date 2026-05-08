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

### 🔄 阶段 1：核心组件开发（2 周）- 进行中

**目标：** 开发 LangChain 核心组件

**任务清单：**
- [ ] 实现 `QwenLLM` 适配器（支持流式/非流式）
- [ ] 实现 `LiteratureVectorStore`（pgvector 适配）
- [ ] 实现三阶段 Session 适配器
- [ ] 实现 `MemoryManager`（多层记忆）
- [ ] 单元测试 + 性能测试

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

开始阶段 1：核心组件开发
