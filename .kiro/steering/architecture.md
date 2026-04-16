# InteractiveDocs 项目架构说明

本文档描述 InteractiveDocs 的整体架构、核心设计决策和关键模块说明。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Zustand |
| 后端 | FastAPI + SQLAlchemy (Async) + Pydantic v2 |
| 数据库 | PostgreSQL |
| AI | 通义千问（DashScope） |
| 文件存储 | 阿里云 OSS |
| 实时通信 | SSE（Server-Sent Events） |

---

## 后端分层架构

```
路由层 (api/v1/)
    ↓ 调用
Service 层 (services/)      ← 业务逻辑、事务控制
    ↓ 调用
Mapper 层 (db/mappers/)     ← 数据读写，只做 flush，不 commit
    ↓ 操作
ORM 模型 (db/models.py)
```

**核心原则：**
- 路由层只做参数解析和响应组装，不写业务逻辑
- Mapper 层只做数据读写，不写业务判断
- Commit 权完全归 Service 层，保证多步操作的原子性

---

## 模板系统

模板系统是本项目的核心，分四层：

```
Template（主表）
├── CoreInfoTemplate    核心信息字段定义（树形，自引用）
├── SummaryTemplate     摘要模板（平铺，有序）
└── StructureTemplate   章节结构模板（树形，自引用）
```

**创建文档流程：**
1. 用户选择模板（type=1 系统模板 或 type=2 用户可复用模板）
2. 系统深拷贝模板主表 + 三类子表，生成 type=0 文档私有副本
3. 文档绑定到私有副本，用户修改不影响原始模板

**模板应用流程（apply-xxx-template）：**
1. 读取文档绑定的私有模板副本
2. 按模板定义创建文档实例数据（DocumentCoreInfo / DocumentSummary / Chapter）
3. 根据 `generation_mode` 决定内容生成方式（复制/AI生成/直接使用/AI修改）
4. 建立 DependencyEdge 依赖关系

**generation_mode 说明：**
- `0` 复制：变量替换 content_template
- `1` AI生成：调 AI，失败降级到复制
- `2` 直接使用：content_template 原文，不替换
- `3` AI修改：以 content_template 为草稿，AI 润色

---

## SSE 实时通信

系统有两类 SSE 接口：

**1. 文档变更事件（`GET /api/v1/documents/{id}/events`）**
- 后台任务（核心信息/摘要变更联动）完成后，通过 `event_bus.publish()` 推送
- 前端收到事件后主动拉取最新数据，不在 SSE 里传数据
- 事件类型：`summary_updated`、`paragraph_updated`、`ping`（心跳）

**2. AI 流式输出（`/ai/chat`、`/paragraphs/{id}/ai/assist` 等）**
- 必须三阶段分离：准备（释放 session）→ 流式输出（无 db 连接）→ 保存（独立 session）
- 流式 generator 内部不接收 `db` 参数，自行用 `AsyncSessionLocal()` 管理

---

## 依赖关系图谱

`dependency_edges` 表记录实体间的依赖关系：

```
Paragraph → Summary（段落依赖摘要）
Summary → CoreInfo（摘要依赖核心信息）
Summary → Summary（摘要依赖其他摘要）
Chapter → Summary（章节依赖摘要）
Chapter → CoreInfo（章节依赖核心信息）
```

**变更联动流程：**
1. 用户修改核心信息 → `is_change=1` → 启动后台任务
2. 后台任务查找下游依赖边 → 重新生成下游摘要/段落
3. 生成完成后通过 SSE 推送 `summary_updated` / `paragraph_updated`
4. 前端收到事件后拉取最新数据

---

## 前端路由结构

```
/                       → 重定向到 /documents
/login                  → 登录页
/register               → 注册页
/documents              → 文档列表（DocumentListContainer）
/documents/[id]         → 文档编辑器（DocumentEditorContainer）
/my-templates           → 用户个人模板库（MyTemplatesContainer）
/admin                  → 管理后台（需 admin 角色）
/admin/templates        → 模板管理
/admin/users            → 用户管理
/admin/documents        → 文档管理
```

---

## 关键配置项

所有配置从环境变量读取，见 `backend/core/config.py`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET_KEY` | JWT 签名密钥 |
| `DASHSCOPE_API_KEY` | 通义千问 API Key |
| `AI_MODEL` | 模型名称（默认 qwen-max） |
| `AI_MAX_CONCURRENCY` | AI 并发上限（默认 5） |
| `AI_TIMEOUT_SECONDS` | 单次请求超时（默认 30s） |
| `REDIS_URL` | Redis 连接串（SSE 事件总线，可选） |
