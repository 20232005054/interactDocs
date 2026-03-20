# InteractiveDocs Backend

基于 FastAPI 的交互式文档写作系统后端服务，提供文档管理、AI 辅助写作、依赖关系追踪等能力。

## 功能特性

- **文档管理**: 创建、查询、更新、删除文档，支持全局变量和快照
- **章节管理**: 章节层级结构、目录提取、内容生成
- **段落管理**: 富文本编辑、AI 帮填、AI 评估、变更追踪
- **摘要管理**: 文档摘要维护、AI 一键生成、关联追踪
- **关键词管理**: 关键词维护、AI 智能提取
- **模板管理**: 系统模板与用户模板、版本控制、回滚
- **AI 对话**: 基于文档上下文的智能聊天助手
- **依赖追踪**: 段落-摘要-关键词之间的依赖关系图谱

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI |
| 数据库 | PostgreSQL |
| ORM | SQLAlchemy (Async) |
| 数据验证 | Pydantic |
| AI 服务 | DashScope (Qwen) |
| 服务器 | Uvicorn |

## 项目结构

```
backend/
├── api/v1/                 # API 路由层
│   ├── documents.py        # 文档接口
│   ├── chapters.py         # 章节接口
│   ├── paragraphs.py       # 段落接口
│   ├── summaries.py        # 摘要接口
│   ├── keywords.py         # 关键词接口
│   ├── templates.py        # 模板接口
│   ├── ai.py               # AI 对话接口
│   └── endpoints.py        # 辅助接口
├── core/                   # 核心组件
│   └── response.py         # 统一响应格式
├── db/                     # 数据层
│   ├── models.py           # SQLAlchemy 模型
│   ├── session.py          # 数据库会话
│   └── mappers/            # 数据访问层
├── schemas/                # Pydantic 模型
│   └── schemas.py          # 请求/响应模型
├── services/               # 业务逻辑层
│   ├── document_service.py
│   ├── chapter_service.py
│   ├── paragraph_service.py
│   ├── summary_service.py
│   ├── keyword_service.py
│   ├── template_service.py
│   ├── ai_service.py       # AI 生成服务
│   ├── ai_chat_service.py  # AI 对话服务
│   ├── dependency_service.py
│   └── endpoint_service.py
├── .trae/documents/        # 项目文档
│   ├── api.md              # API 文档
│   └── database.md         # 数据库文档
├── main.py                 # 应用入口
└── README.md               # 本文件
```

## 快速开始

### 环境要求

- Python 3.9+
- PostgreSQL 12+

### 安装依赖

```bash
pip install fastapi uvicorn sqlalchemy asyncpg pydantic email-validator dashscope
```

### 数据库配置

1. 创建 PostgreSQL 数据库
2. 修改 `db/session.py` 中的连接字符串（默认: `postgresql+asyncpg://postgres:123456@localhost:5432/agent01`）

### 启动服务

```bash
# 开发模式
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# 或直接运行
python main.py
```

服务启动后访问:
- 根路径: http://localhost:8001/
- API 文档: http://localhost:8001/docs

## API 概览

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/documents` | 创建文档 |
| GET | `/api/v1/documents` | 文档列表 |
| GET | `/api/v1/documents/{id}` | 文档详情 |
| PUT | `/api/v1/documents/{id}` | 更新文档 |
| DELETE | `/api/v1/documents/{id}` | 删除文档 |

### 章节管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/chapters/{id}` | 章节详情 |
| POST | `/api/v1/chapters/{document_id}` | 创建章节 |
| PUT | `/api/v1/chapters/{id}` | 更新章节 |
| DELETE | `/api/v1/chapters/{id}` | 删除章节 |
| GET | `/api/v1/chapters/{id}/toc` | 章节目录 |

### 段落管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/paragraphs/{id}` | 段落详情 |
| POST | `/api/v1/chapters/{id}/paragraphs` | 创建段落 |
| PUT | `/api/v1/paragraphs/{id}` | 更新段落 |
| DELETE | `/api/v1/paragraphs/{id}` | 删除段落 |
| POST | `/api/v1/paragraphs/{id}/ai/assist` | AI 帮填 |
| POST | `/api/v1/paragraphs/{id}/ai/evaluate` | AI 评估 |

### AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai/chat` | AI 聊天 (SSE) |

完整 API 文档见 [.trae/documents/api.md](.trae/documents/api.md)

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "成功",
  "data": {}
}
```

### 错误响应

```json
{
  "code": 404,
  "message": "资源不存在",
  "data": null
}
```

### 流式响应 (SSE)

```
data: {"content":"..."}

data: {"response":"..."}

data: [DONE]
```

## 核心概念

### 模板复制机制

创建文档时，系统会复制选定的模板生成新的用户模板，文档绑定到新模板而非直接引用原模板。

### 依赖关系追踪

通过 `dependency_edges` 表维护实体间关系:
- 段落生成时记录使用的摘要和关键词
- 支持上游变更通知下游

### 变更状态标记

| 实体 | 字段 | 值 | 含义 |
|------|------|-----|------|
| 段落 | `ischange` | 0 | 无变更 |
| 段落 | `ischange` | 1 | 自身修改 |
| 段落 | `ischange` | 2 | 上游变更待刷新 |
| 摘要 | `is_change` | 0 | 无变更 |
| 摘要 | `is_change` | 1 | 自身修改 |
| 摘要 | `is_change` | 3 | 下游变更待审视 |

## 文档

- [API 文档](.trae/documents/api.md) - 完整接口说明
- [数据库文档](.trae/documents/database.md) - 表结构和关系

## 注意事项

1. 数据库连接字符串在 `db/session.py` 中硬编码，生产环境建议改为环境变量
2. AI 功能需要配置 DashScope API Key
3. 当前无数据库迁移脚本，建议使用 SQL 直接建表
