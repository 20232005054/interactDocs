# 应用模板时使用 LangChain 重构 Spec

## Why
现有应用模板时的 AI 调用代码分散在多个文件中，重试、超时、并发控制等基础设施代码手动实现，维护成本高。使用 LangChain 可以简化 AI 调用，提高代码可维护性和复用性。

## What Changes
- 新建 `langchain` 分支进行开发
- 创建 LangChain 模块（LLM 封装、提示词管理、输出解析）
- 重构应用模板服务，使用 LangChain 进行 AI 调用
- 保持与现有代码的兼容性，通过配置开关控制

## Impact
- Affected specs: 应用模板功能
- Affected code: 
  - 新增: `backend/services/langchain/` 目录
  - 新增: `backend/services/document_service_v2.py`
  - 修改: `backend/api/v1/documents.py`
  - 修改: `backend/requirements.txt`

## ADDED Requirements

### Requirement: LangChain 基础设施模块
系统应提供高内聚低耦合的 LangChain 基础设施模块，供应用模板和其他 AI 功能复用。

#### Scenario: LLM 调用封装
- **WHEN** 需要调用 AI 生成内容
- **THEN** 通过统一的 LLM 服务接口调用，自动处理重试、超时、并发控制

#### Scenario: 提示词管理
- **WHEN** 需要格式化提示词
- **THEN** 通过提示词管理器统一管理，支持变量替换和自定义模板

#### Scenario: 输出解析
- **WHEN** AI 返回结果
- **THEN** 通过输出解析器解析，支持多种输出格式

### Requirement: 应用模板使用 LangChain
应用模板时的 AI 调用应使用 LangChain 模块，保持与现有功能的兼容性。

#### Scenario: 应用摘要模板（AI 模式）
- **WHEN** 用户应用摘要模板且 generation_mode=1
- **THEN** 使用 LangChain 调用 AI 生成内容，失败时自动降级到复制模式

#### Scenario: 应用结构模板（AI 模式）
- **WHEN** 用户应用结构模板且 generation_mode=1
- **THEN** 使用 LangChain 调用 AI 生成段落内容，失败时自动降级到复制模式

### Requirement: 配置开关控制
系统应支持通过配置开关控制是否使用 LangChain 版本。

#### Scenario: 启用 LangChain
- **WHEN** 环境变量 USE_LANGCHAIN=true
- **THEN** 使用 LangChain 版本的应用模板服务

#### Scenario: 禁用 LangChain
- **WHEN** 环境变量 USE_LANGCHAIN=false 或未设置
- **THEN** 使用原有版本的应用模板服务

## MODIFIED Requirements
无

## REMOVED Requirements
无
