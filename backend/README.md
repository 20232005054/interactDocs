# InteractiveDocs Backend

基于 FastAPI 的交互式文档写作系统后端服务，提供文档管理、AI 辅助写作、模板驱动生成、依赖关系追踪等能力。

## 功能特性

- **用户认证**: JWT 登录注册，角色权限控制（user / editor / admin）
- **文档管理**: 创建、查询、更新、删除文档，支持快照版本管理与恢复
- **章节管理**: 树形多级嵌套结构、拖拽排序、目录提取
- **段落管理**: 富文本编辑、AI 帮填、AI 评估、变更追踪
- **摘要管理**: 文档摘要维护、AI 一键生成、关联追踪
- **核心信息管理**: 文档核心信息（全局变量）的树形维护与管理
- **模板管理**: 系统模板与用户模板、核心信息模板、摘要模板、结构模板的完整 CRUD
- **模板应用**: 一键应用模板生成核心信息、摘要、章节结构，支持 AI 生成与降级策略
- **AI 对话**: 基于文档上下文的智能聊天助手（SSE 流式）
- **依赖追踪**: 段落-摘要-核心信息之间的依赖关系图谱，支持上下游变更联动
- **文件上传**: 图片上传至阿里云 OSS
- **文档导出**: 导出为 Word 文档
- **管理后台**: 用户管理、文档管理、系统统计

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI |
| 数据库 | PostgreSQL |
| ORM | SQLAlchemy (Async) |
| 数据验证 | Pydantic v2 |
| AI 服务 | DashScope (通义千问) |
| 文件存储 | 阿里云 OSS |
| 服务器 | Uvicorn |

## 项目结构

```
backend/
├── api/v1/                     # API 路由层
│   ├── auth.py                 # 认证接口（注册/登录/用户信息）
│   ├── documents.py            # 文档接口
│   ├── chapters.py             # 章节接口
│   ├── paragraphs.py           # 段落接口
│   ├── summaries.py            # 摘要接口
│   ├── core_info.py            # 核心信息接口
│   ├── templates.py            # 模板主表接口
│   ├── core_info_templates.py  # 核心信息模板接口
│   ├── summary_templates.py    # 摘要模板接口
│   ├── structure_templates.py  # 结构模板接口
│   ├── ai.py                   # AI 对话接口
│   ├── events.py               # SSE 事件推送接口
│   ├── upload.py               # 文件上传接口
│   ├── export.py               # 文档导出接口
│   ├── endpoints.py            # 辅助接口
│   └── admin/                  # 管理后台接口
│       ├── users.py
│       ├── documents.py
│       └── stats.py
├── core/                       # 核心组件
│   ├── auth.py                 # 鉴权依赖（get_current_user / get_editor_user / get_admin_user）
│   ├── config.py               # 全局配置（从环境变量读取）
│   ├── constants.py            # 枚举常量（UserRole / TemplateType / EdgeSourceType / EdgeTargetType）
│   ├── response.py             # 统一响应格式与异常处理（含全局 logger）
│   ├── security.py             # JWT 生成与验证、密码哈希
│   └── utils.py                # 公共工具函数（log_task_exception 等）
├── db/                         # 数据层
│   ├── models.py               # SQLAlchemy ORM 模型
│   ├── session.py              # 数据库会话
│   └── mappers/                # 数据访问层（每个实体一个 mapper）
├── schemas/                    # Pydantic 模型
│   ├── schemas.py              # 请求体模型
│   └── response_schemas.py     # 响应体模型
├── services/                   # 业务逻辑层
│   ├── document_service.py     # 文档业务（含模板深拷贝、模板导出）
│   ├── template_apply_service.py   # 模板应用（核心信息/摘要/结构，含 AI 并发生成与降级）
│   ├── core_info_change_service.py # 核心信息变更后台联动处理
│   ├── summary_change_service.py   # 摘要变更后台联动处理
│   ├── chapter_service.py
│   ├── paragraph_service.py
│   ├── summary_service.py
│   ├── core_info_service.py
│   ├── template_service.py
│   ├── summary_template_service.py
│   ├── structure_template_service.py
│   ├── core_info_template_service.py
│   ├── template_render_service.py  # 模板渲染公共服务（变量替换 / AI 调用）
│   ├── ai_service.py           # AI 帮填 / 评估 / 摘要生成
│   ├── ai_chat_service.py      # AI 对话服务
│   ├── ai_client.py            # DashScope 客户端（重试 / 超时 / 并发控制）
│   ├── dependency_service.py   # 依赖边管理
│   ├── event_bus.py            # SSE 事件总线
│   ├── export_service.py       # Word 导出
│   ├── oss_service.py          # 阿里云 OSS 上传
│   └── user_service.py
│   ├── sql/
│   │   ├── database.sql            # 建表脚本（最新版本）
│   │   ├── migrate_template_type.sql  # 迁移：is_system → template_type
│   │   └── insert_template_test_data.sql  # 测试数据
├── .env                        # 环境变量（本地开发）
├── main.py                     # 应用入口
├── requirements.txt            # 依赖清单
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- PostgreSQL 14+

### 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 环境变量配置

复制 `.env` 并填写以下配置：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/interactivedocs

# JWT
JWT_SECRET_KEY=your-secret-key

# 通义千问 AI
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=qwen-max
AI_TIMEOUT_SECONDS=60.0
AI_MAX_RETRIES=2

# 阿里云 OSS（可选）
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET_NAME=
OSS_BASE_URL=
```

> `DASHSCOPE_API_KEY` 也可以直接配置在系统环境变量中，`load_dotenv()` 不会覆盖已有的系统变量。

### 初始化数据库

```bash
psql -U postgres -d interactivedocs -f sql/database.sql
```

如有历史数据库，按需执行 `sql/migrate_*.sql` 中的增量迁移脚本。

> **注意**：如果从旧版本升级，需执行 `sql/migrate_template_type.sql` 将 `templates.is_system` 字段迁移为 `template_type` 整数枚举。

### 启动服务

```bash
# 开发模式（热重载）
python main.py

# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

服务启动后访问：
- API 文档（Swagger）：http://localhost:8001/docs
- 根路径健康检查：http://localhost:8001/

## API 概览

所有业务接口需在请求头携带 `Authorization: Bearer <token>`，登录注册接口无需鉴权。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录，返回 JWT token |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| PUT | `/api/v1/auth/me` | 更新个人信息 |

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/documents` | 创建文档（同时复制模板） |
| GET | `/api/v1/documents` | 文档列表（分页） |
| GET | `/api/v1/documents/{id}` | 文档详情 |
| PUT | `/api/v1/documents/{id}` | 更新文档 |
| DELETE | `/api/v1/documents/{id}` | 删除文档 |
| GET | `/api/v1/documents/{id}/full-content` | 全量内容（章节树+段落，一次返回） |
| GET | `/api/v1/documents/{id}/template-info` | 文档关联的完整模板信息 |
| POST | `/api/v1/documents/{id}/apply-core-info-template` | 应用核心信息模板 |
| POST | `/api/v1/documents/{id}/apply-summary-template` | 应用摘要模板 |
| POST | `/api/v1/documents/{id}/apply-structure-template` | 应用结构模板（含 AI 生成） |
| GET | `/api/v1/documents/{id}/snapshots` | 快照列表 |
| POST | `/api/v1/documents/{id}/snapshots` | 创建快照 |
| POST | `/api/v1/documents/{id}/snapshots/{sid}/restore` | 从快照恢复 |

### 章节管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/chapters/document/{document_id}` | 章节树 |
| GET | `/api/v1/chapters/{id}` | 章节详情（含段落） |
| POST | `/api/v1/chapters/document/{document_id}` | 创建根章节 |
| POST | `/api/v1/chapters/document/{document_id}/sub/{parent_id}` | 创建子章节 |
| PUT | `/api/v1/chapters/{id}` | 更新章节 |
| DELETE | `/api/v1/chapters/{id}` | 删除章节 |
| POST | `/api/v1/chapters/reorder` | 拖拽排序 |

### 段落管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/paragraphs/{id}` | 段落详情 |
| POST | `/api/v1/chapters/{id}/paragraphs` | 创建段落 |
| PUT | `/api/v1/paragraphs/{id}` | 更新段落 |
| DELETE | `/api/v1/paragraphs/{id}` | 删除段落 |
| POST | `/api/v1/paragraphs/{id}/ai/assist` | AI 帮填（SSE） |
| POST | `/api/v1/paragraphs/{id}/ai/evaluate` | AI 评估（SSE） |

### 摘要管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/summaries/document/{document_id}` | 文档摘要列表 |
| PUT | `/api/v1/summaries/{id}` | 更新摘要 |
| POST | `/api/v1/summaries/{id}/ai/generate` | AI 生成摘要建议 |

### 核心信息管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/core-info/document/{document_id}` | 获取核心信息树 |
| PUT | `/api/v1/core-info/{id}` | 更新单条核心信息 |
| POST | `/api/v1/core-info/document/{document_id}/batch` | 批量保存 |

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/templates` | 模板列表（支持分页、关键词搜索） |
| POST | `/api/v1/templates` | 创建模板 |
| GET | `/api/v1/templates/{id}` | 模板详情 |
| PUT | `/api/v1/templates/{id}` | 管理员更新模板（创建新版本） |
| PUT | `/api/v1/templates/{id}/content` | 用户更新模板描述 |
| DELETE | `/api/v1/templates/{id}` | 删除模板 |
| POST | `/api/v1/templates/rollback/{id}` | 回退到官方模板 |
| GET | `/api/v1/templates/purposes/list` | 获取所有用途分类 |
| GET | `/api/v1/core-info-templates/template/{template_id}` | 核心信息模板树 |
| GET | `/api/v1/summary-templates/template/{template_id}` | 摘要模板列表 |
| GET | `/api/v1/structure-templates/template/{template_id}/tree` | 结构模板树 |

### AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai/chat` | AI 聊天（SSE 流式） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/documents/{id}/events` | SSE 文档变更事件订阅 |
| POST | `/api/v1/upload/image` | 上传图片到 OSS |
| GET | `/api/v1/export/document/{id}` | 导出 Word 文档 |

### 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表 |
| PUT | `/api/v1/admin/users/{id}/role` | 修改用户角色 |
| GET | `/api/v1/admin/documents` | 所有文档列表 |
| GET | `/api/v1/admin/stats` | 系统统计概览 |

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
  "message": "文档不存在",
  "data": null
}
```

### 流式响应（SSE）

```
data: {"content": "..."}

data: [DONE]
```

## 核心概念

### 用户角色与权限

| 角色 | 说明 |
|------|------|
| `user` | 普通用户，只能操作自己的文档 |
| `editor` | 编辑，额外可以创建和修改模板 |
| `admin` | 管理员，全部权限 |

### 模板复制机制

创建文档时，系统会将选定的模板（含核心信息模板、摘要模板、结构模板子表）完整深拷贝，生成一份文档私有副本（`template_type=0`），文档绑定到该副本而非直接引用原始模板，保证用户修改不影响原始模板。

### 模板类型（template_type）

| 值 | 名称 | 说明 |
|---|---|---|
| `0` | 文档私有副本 | 创建文档时自动生成，绑定到具体文档，不可复用 |
| `1` | 系统模板 | 由 editor/admin 维护，所有用户可选用 |
| `2` | 用户可复用模板 | 用户从文档导出的个人模板库，创建文档时可选用 |
| `3` | 用户公开模板 | 预留，未实现 |

用户可通过 `POST /api/v1/documents/{id}/export-template` 将文档的私有模板副本导出到个人模板库（type=2）。

### 模板生成模式

| `generation_mode` | 名称 | 行为 |
|---|---|---|
| `0` | 复制模式 | 按 `content_template` + `sources` 做变量替换，不调用 AI |
| `1` | AI 生成模式 | 按 `sources` 装配上下文，用 `custom_prompt` 或 `default_prompt` 调用 AI |
| `2` | 直接使用 | `content_template` 原文直接写入，不做任何替换或 AI 调用 |
| `3` | AI 修改模式 | 以 `content_template` 为草稿，AI 润色后写入 |

### AI 降级策略

mode=1/3 在以下情况自动降级到复制模式（mode=0），确保模板应用不中断：
- 来源数据装配失败
- AI 调用超时或异常
- AI 返回空内容

降级结果通过 `degraded=true` 标记，`generation_error` 包含 `trace_id`、`error_type`、`error_message`、`error_code`、`duration_ms` 供排障使用。

### AI 客户端配置

| 环境变量 | 默认值 | 说明 |
|------|------|------|
| `DASHSCOPE_API_KEY` | — | 通义千问 API Key（必填） |
| `AI_MODEL` | `qwen-max` | 模型名称 |
| `AI_TIMEOUT_SECONDS` | `30` | 单次请求超时（秒） |
| `AI_MAX_RETRIES` | `2` | 超时/异常后最大重试次数 |
| `AI_RETRY_BACKOFF_SECONDS` | `0.8` | 重试退避基数（按次数递增） |
| `AI_MAX_CONCURRENCY` | `5` | 并发上限（信号量控制） |

### 依赖关系追踪

通过 `dependency_edges` 表维护实体间的依赖关系：
- 摘要依赖核心信息或其他摘要
- 段落依赖摘要
- 上游变更时通过 SSE 事件通知前端，前端按需拉取最新数据

### 变更状态标记

| 实体 | 字段 | 值 | 含义 |
|------|------|-----|------|
| 段落 | `ischange` | `0` | 无变更 |
| 段落 | `ischange` | `1` | 用户手动修改 |
| 摘要 | `is_change` | `0` | 无变更 |
| 摘要 | `is_change` | `1` | 用户手动修改 |
| 摘要 | `is_change` | `2` | 上游联动已更新 |
| 摘要 | `is_change` | `3` | 下游变更，AI 已重新生成建议（待用户确认） |
| 核心信息 | `is_change` | `0` | 无变更 |
| 核心信息 | `is_change` | `1` | 已修改 |

## 注意事项

1. `DASHSCOPE_API_KEY` 配置在系统环境变量或 `.env` 文件中均可，系统变量优先级更高
2. `.env` 文件不应提交到版本库（已在 `.gitignore` 中排除）
3. 数据库迁移通过 `sql/migration_*.sql` 手动执行，无自动迁移工具
4. 生产环境建议调大 `AI_TIMEOUT_SECONDS`（推荐 60s）并根据并发量调整 `AI_MAX_CONCURRENCY`
