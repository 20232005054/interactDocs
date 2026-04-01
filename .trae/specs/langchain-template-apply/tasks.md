# Tasks

- [x] Task 1: 创建 langchain 分支
  - [x] SubTask 1.1: 从当前分支创建新分支 langchain

- [x] Task 2: 安装 LangChain 依赖
  - [x] SubTask 2.1: 更新 requirements.txt，添加 langchain 相关依赖
  - [x] SubTask 2.2: 安装依赖

- [x] Task 3: 创建 LangChain 基础设施模块
  - [x] SubTask 3.1: 创建 `backend/services/langchain/` 目录结构
  - [x] SubTask 3.2: 创建配置管理模块 `config.py`
  - [x] SubTask 3.3: 创建 LLM 封装模块 `llm.py`（包含重试、超时、并发控制）
  - [x] SubTask 3.4: 创建提示词管理模块 `prompts.py`
  - [x] SubTask 3.5: 创建输出解析模块 `parsers.py`
  - [x] SubTask 3.6: 创建数据来源构建模块 `sources.py`
  - [x] SubTask 3.7: 创建模块初始化文件 `__init__.py`

- [x] Task 4: 创建应用模板服务 V2
  - [x] SubTask 4.1: 创建 `document_service_v2.py`
  - [x] SubTask 4.2: 实现应用核心信息模板方法（复用现有逻辑）
  - [x] SubTask 4.3: 实现应用摘要模板方法（使用 LangChain）
  - [x] SubTask 4.4: 实现应用结构模板方法（使用 LangChain）

- [x] Task 5: 更新 API 路由
  - [x] SubTask 5.1: 修改 `documents.py`，添加配置开关控制
  - [x] SubTask 5.2: 添加 USE_LANGCHAIN 环境变量支持

- [x] Task 6: 测试验证
  - [x] SubTask 6.1: 测试应用核心信息模板（不使用 AI）
  - [x] SubTask 6.2: 测试应用摘要模板（复制模式）
  - [x] SubTask 6.3: 测试应用摘要模板（AI 模式）
  - [x] SubTask 6.4: 测试应用结构模板（复制模式）
  - [x] SubTask 6.5: 测试应用结构模板（AI 模式）
  - [x] SubTask 6.6: 测试降级机制

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 4
- Task 6 依赖 Task 5
