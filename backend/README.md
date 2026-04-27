# InteractiveDocs Backend

基于 FastAPI 的交互式文档写作系统后端服务，提供文档管理、AI 辅助写作、模板驱动生成、文献知识库 RAG、依赖关系追踪等能力。

## 功能特性

- **用户认证**：JWT 登录注册，角色权限控制（user / editor / admin）
- **文档管理**：创建、查询、更新、删除文档，支持快照版本管理与恢复
- **章节管理**：树形多级嵌套结构、拖拽排序、目录提取
- **段落管理**：Markdown 编辑、AI 帮填、AI 评估、变更追踪
- **摘要管理**：文档摘要维护、AI 一键生成、关联追踪
- **核心信息管理**：文档核心信息（全局变量）的树形维护与管理
- **模板管理**：系统模板与用户模板、核心信息模板、摘要模板、结构模板的完整 CRUD，支持 JSON 导入导出
- **模板应用**：一键应用模板生成核心信息、摘要、章节结构，支持 AI 生成与降级策略
- **文献知识库**：PDF 上传、自动解析向量化、RAG 检索注入 AI 生成上下文、引用记录追踪
- **AI 对话**：基于文档上下文的智能聊天助手（SSE 流式）
- **依赖追踪**：段落-摘要-核心信息之间的依赖关系图谱，支持上下游变更联动
- **文件存储**：支持本地磁盘和阿里云 OSS 双后端，通过环境变量切换
- **文档导出**：导出为 Word (.docx)、Markdown (.md)、PDF（需 GTK 运行时）
- **管理后台**：用户管理、文档管理、系统统计

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI |
| 数据库 | PostgreSQL 14+ + pgvector 扩展 |
| ORM | SQLAlchemy (Async) |
| 数据验证 | Pydantic v2 |
| AI 服务 | DashScope（通义千问） |
| 向量检索 | pgvector（余弦相似度） |
| 文献解析 | PyPDFLoader + RecursiveCharacterTextSplitter |
| 文件存储 | 本地磁盘 / 阿里云 OSS |
| 实时通信 | SSE（Server-Sent Events）+ Redis 事件总线 |
| 服务器 | Uvicorn |

## 项目结构

```
backend/
├── api/v1/                     # API 路由层
│   ├── auth.py                 # 认证接口
│   ├── documents.py            # 文档接口（含模板应用、引用查询）
│   ├── chapters.py             # 章节接口
│   ├── paragraphs.py           # 段落接口
│   ├── summaries.py            # 摘要接口
│   ├── core_info.py            # 核心信息接口
│   ├── templates.py            # 模板主表接口
│   ├── core_info_templates.py  # 核心信息模板接口
│   ├── summary_templates.py    # 摘要模板接口
│   ├── structure_templates.py  # 结构模板接口
│   ├── literature.py           # 文献知识库接口
│   ├── ai.py                   # AI 对话接口
│   ├── events.py               # SSE 事件推送接口
│   ├── upload.py               # 文件上传接口
│   ├── export.py               # 文档导出接口
│   └── admin/                  # 管理后台接口
├── core/                       # 核心组件
│   ├── auth.py                 # 鉴权依赖
│   ├── config.py               # 全局配置
│   ├── constants.py            # 枚举常量
│   ├── response.py             # 统一响应格式
│   ├── security.py             # JWT / 密码哈希
│   └── utils.py                # 公共工具函数
├── db/
│   ├── models.py               # SQLAlchemy ORM 模型
│   ├── session.py              # 数据库会话
│   └── mappers/                # 数据访问层
├── schemas/                    # Pydantic 模型
├── services/                   # 业务逻辑层
│   ├── literature_service.py   # 文献上传、处理、管理
│   ├── literature_rag_service.py  # RAG 检索、引用注入、引用保存
│   ├── template_render_service.py # 模板渲染（变量替换 / AI 调用 / RAG 注入）
│   ├── template_apply_service.py  # 模板应用（含 AI 并发生成与降级）
│   ├── ai_client.py            # DashScope 客户端（重试 / 超时 / 并发控制）
│   ├── oss_service.py          # 文件存储（本地 / OSS 双后端）
│   ├── event_bus.py            # SSE 事件总线（Redis / 内存双模式）
│   └── export_service.py       # 文档导出（Word / PDF / Markdown）
├── .env                        # 环境变量（本地开发，不提交）
├── main.py                     # 应用入口
├── requirements.txt            # 依赖清单
└── README.md
```

---

## 快速开始

### 环境要求

- Python 3.10+
- PostgreSQL 14+（**必须安装 pgvector 扩展**，用于文献向量检索）
- Redis 5+（SSE 事件总线，单机开发可用内存模式跳过）

---

## 数据库环境搭建

### 1. 安装 PostgreSQL

推荐 PostgreSQL 14 或 15。

**macOS（Homebrew）**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu / Debian**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows**
从 [postgresql.org](https://www.postgresql.org/download/windows/) 下载安装包，安装时记录超级用户密码。

---

### 2. 安装 pgvector 扩展

pgvector 是文献知识库的核心依赖，用于存储和检索文献分块的向量嵌入。

**方式一：包管理器安装（推荐）**

```bash
# Ubuntu / Debian
sudo apt install postgresql-15-pgvector

# macOS（Homebrew）
brew install pgvector
```

**方式二：从源码编译**

```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**在数据库中启用扩展**

```sql
-- 连接到目标数据库后执行
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';
```

> **注意**：pgvector 必须在建表之前启用，否则 `literature_chunks.embedding` 字段的 `vector` 类型无法创建。

---

### 3. 创建数据库

```bash
# 连接 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE interactivedocs;

# 连接到新数据库
\c interactivedocs

# 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

# 退出
\q
```

---

### 4. 初始化表结构

```bash
psql -U postgres -d interactivedocs -f sql/database.sql
```

如从旧版本升级，按需执行 `sql/migrate_*.sql` 中的增量迁移脚本。

**关键表说明：**

| 表名 | 说明 |
|------|------|
| `users` | 用户账号 |
| `documents` | 文档主表 |
| `chapters` | 章节（树形自引用） |
| `paragraphs` | 段落（Markdown 内容） |
| `document_summaries` | 文档摘要 |
| `document_core_info` | 核心信息（树形自引用） |
| `templates` | 模板主表 |
| `core_info_templates` | 核心信息模板 |
| `summary_templates` | 摘要模板 |
| `structure_templates` | 结构模板 |
| `dependency_edges` | 依赖关系图谱 |
| `literature` | 文献主表 |
| `template_literature` | 模板-文献多对多关联 |
| `literature_chunks` | 文献分块向量表（需 pgvector） |
| `document_citations` | 文档引用记录 |

---

### 5. 验证 pgvector 是否正常工作

```sql
-- 连接数据库后执行
\c interactivedocs

-- 检查 vector 类型是否可用
SELECT '[1,2,3]'::vector;

-- 检查 literature_chunks 表的 embedding 列类型
\d literature_chunks
```

`embedding` 列应显示为 `vector` 类型（维度取决于所用 embedding 模型，DashScope text-embedding-v3 为 1024 维）。

---

### 6. Redis 配置（可选）

Redis 用于 SSE 事件总线的多进程广播。单进程开发模式下，系统会自动降级为内存模式，无需 Redis。

**安装 Redis**

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu
sudo apt install redis-server && sudo systemctl start redis
```

**验证连接**

```bash
redis-cli ping  # 返回 PONG 表示正常
```

---

## 环境变量配置

复制 `.env.example` 为 `.env` 并填写：

```env
# ============================================================
# 数据库
# ============================================================
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/interactivedocs
DB_ECHO=false  # true 时终端输出所有 SQL，调试用

# ============================================================
# Redis（SSE 事件总线）
# 不配置或连接失败时自动降级为内存模式
# ============================================================
REDIS_URL=redis://localhost:6379/5

# ============================================================
# 文件存储
# STORAGE_BACKEND=local   本地磁盘（默认，开发环境推荐）
# STORAGE_BACKEND=oss     阿里云 OSS
# ============================================================
STORAGE_BACKEND=local
# LOCAL_STORAGE_PATH=static          # 本地存储目录（相对 backend/）
# LOCAL_STORAGE_URL_PREFIX=/static   # 文件访问 URL 前缀

# 阿里云 OSS（STORAGE_BACKEND=oss 时填写）
# OSS_ACCESS_KEY_ID=
# OSS_ACCESS_KEY_SECRET=
# OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
# OSS_BUCKET_NAME=
# OSS_BASE_URL=  # 可选，CDN 域名

# ============================================================
# 通义千问 AI
# ============================================================
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=qwen-plus
AI_TIMEOUT_SECONDS=60.0
AI_MAX_RETRIES=2
AI_RETRY_BACKOFF_SECONDS=0.8
AI_MAX_CONCURRENCY=5
```

> `DASHSCOPE_API_KEY` 也可配置在系统环境变量中，优先级高于 `.env`。

---

## 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

主要依赖说明：

| 包 | 用途 |
|---|---|
| `fastapi` / `uvicorn` | Web 框架 |
| `sqlalchemy[asyncio]` / `asyncpg` | 异步 ORM |
| `pgvector` | pgvector Python 客户端 |
| `dashscope` | 通义千问 AI（含 embedding） |
| `langchain-community` | PyPDFLoader（PDF 解析） |
| `langchain-text-splitters` | 文本分块 |
| `httpx` | CrossRef API 调用 |
| `python-docx` / `weasyprint` | Word / PDF 导出 |
| `markdown` / `beautifulsoup4` | Markdown → HTML 转换 |
| `redis[asyncio]` | SSE 事件总线 |
| `oss2` | 阿里云 OSS |

---

## 启动服务

```bash
# 开发模式（热重载）
python main.py

# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

服务启动后：
- Swagger 文档：http://localhost:8001/docs
- 健康检查：http://localhost:8001/

---

## 文献知识库

### 工作原理

```
上传 PDF
  → 存储（本地/OSS）
  → 后台异步处理：
      1. PyPDFLoader 解析全文
      2. RecursiveCharacterTextSplitter 分块（500字/50重叠）
      3. DashScope text-embedding-v3 向量化
      4. 写入 literature_chunks（pgvector）
      5. 正则提取 DOI → CrossRef API 补全 metadata
  → upload_status: pending → processing → ready / failed
```

### 向量检索（RAG）

AI 生成内容时，系统自动：
1. 对生成 prompt 调用 embedding 接口
2. 在 `literature_chunks` 中用余弦距离检索 top-5 相关片段
3. 检索范围：文档绑定模板下的文献（public 全员可见，private 仅上传者可见）
4. 将文献片段注入 prompt，要求 AI 以 `[1][2]` 格式引用
5. 解析 AI 返回内容中的引用标记，写入 `document_citations` 表

### 文献权限

| scope | 上传者 | 可见范围 | 可删改 |
|---|---|---|---|
| `public` | editor / admin | 所有用户 | editor / admin |
| `private` | 普通用户 | 仅上传者 | 仅上传者 |

### 文献绑定

文献需绑定到模板才能参与 RAG 检索：

```
POST /api/v1/templates/{template_id}/literature/{literature_id}  # 绑定
DELETE /api/v1/templates/{template_id}/literature/{literature_id}  # 解绑
GET /api/v1/templates/{template_id}/literature  # 查看绑定列表
```

创建文档时，模板的文献绑定关系会随模板一起深拷贝到文档私有副本。

### 常见问题

**Q: 文献上传后一直是 pending/processing 状态？**

检查：
1. DashScope API Key 是否有效（embedding 接口需要单独开通）
2. pgvector 扩展是否已启用（`SELECT * FROM pg_extension WHERE extname = 'vector'`）
3. 后端日志中是否有 `[文献处理]` 相关错误

**Q: AI 生成内容没有引用标记 [1][2]？**

检查：
1. 文献是否已绑定到文档对应的模板
2. 文献 `upload_status` 是否为 `ready`
3. 后端日志中是否有 `文献 RAG 注入失败` 警告

---

## API 概览

所有业务接口需在请求头携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录，返回 JWT token |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| PUT | `/api/v1/auth/me` | 更新个人信息 |
| PUT | `/api/v1/auth/me/password` | 修改密码 |

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/documents` | 创建文档（同时深拷贝模板） |
| GET | `/api/v1/documents` | 文档列表（分页） |
| GET | `/api/v1/documents/{id}` | 文档详情 |
| PUT | `/api/v1/documents/{id}` | 更新文档 |
| DELETE | `/api/v1/documents/{id}` | 删除文档 |
| GET | `/api/v1/documents/{id}/full-content` | 全量内容（章节树+段落） |
| GET | `/api/v1/documents/{id}/template-info` | 文档关联的完整模板信息 |
| POST | `/api/v1/documents/{id}/apply-core-info-template` | 应用核心信息模板 |
| POST | `/api/v1/documents/{id}/apply-summary-template` | 应用摘要模板 |
| POST | `/api/v1/documents/{id}/apply-structure-template` | 应用结构模板（含 AI 生成） |
| POST | `/api/v1/documents/{id}/export-template` | 导出为个人模板库 |
| POST | `/api/v1/documents/{id}/sync-template` | 同步到原始模板最新版本 |
| GET | `/api/v1/documents/{id}/citations` | 获取文档引用文献列表 |
| GET | `/api/v1/documents/{id}/snapshots` | 快照列表 |
| POST | `/api/v1/documents/{id}/snapshots` | 创建快照 |
| POST | `/api/v1/documents/{id}/snapshots/{sid}/restore` | 从快照恢复 |

### 文献知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/literature` | 上传 PDF 文献（multipart/form-data） |
| GET | `/api/v1/literature` | 查询文献列表（scope 过滤） |
| GET | `/api/v1/literature/{id}` | 文献详情 |
| PUT | `/api/v1/literature/{id}` | 更新文献元数据 |
| DELETE | `/api/v1/literature/{id}` | 删除文献 |
| POST | `/api/v1/literature/{id}/retry` | 重新处理失败文献 |
| POST | `/api/v1/templates/{id}/literature/{lit_id}` | 绑定文献到模板 |
| DELETE | `/api/v1/templates/{id}/literature/{lit_id}` | 解绑文献 |
| GET | `/api/v1/templates/{id}/literature` | 模板绑定的文献列表 |

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/templates` | 模板列表 |
| POST | `/api/v1/templates` | 创建模板（editor+） |
| GET | `/api/v1/templates/{id}` | 模板详情 |
| PUT | `/api/v1/templates/{id}` | 更新模板（editor+） |
| DELETE | `/api/v1/templates/{id}` | 删除模板（editor+） |
| GET | `/api/v1/templates/{id}/preview` | 模板完整预览 |
| GET | `/api/v1/templates/{id}/versions` | 版本历史 |
| GET | `/api/v1/templates/{id}/export` | 导出为 JSON 文件 |
| POST | `/api/v1/templates/import` | 从 JSON 文件导入 |
| GET | `/api/v1/templates/purposes/list` | 获取所有用途分类 |

### 文档导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/documents/{id}/export/docx` | 导出 Word |
| GET | `/api/v1/documents/{id}/export/md` | 导出 Markdown |
| GET | `/api/v1/documents/{id}/export/pdf` | 导出 PDF（需 GTK 运行时） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/documents/{id}/events` | SSE 文档变更事件订阅 |
| POST | `/api/v1/ai/chat` | AI 对话（SSE 流式） |
| POST | `/api/v1/upload/image` | 上传图片 |

### 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表 |
| PUT | `/api/v1/admin/users/{id}/role` | 修改用户角色 |
| DELETE | `/api/v1/admin/users/{id}` | 删除用户 |
| GET | `/api/v1/admin/documents` | 所有文档列表（支持筛选） |
| DELETE | `/api/v1/admin/documents/{id}` | 强制删除文档 |
| GET | `/api/v1/admin/stats/overview` | 系统统计概览 |

---

## 响应格式

```json
// 成功
{ "code": 200, "message": "成功", "data": {} }

// 错误
{ "code": 404, "message": "文档不存在", "data": null }

// SSE 流式
data: {"content": "..."}
data: [DONE]
```

---

## 核心概念

### 模板类型（template_type）

| 值 | 名称 | 说明 |
|---|---|---|
| `0` | 文档私有副本 | 创建文档时自动深拷贝，绑定到具体文档 |
| `1` | 系统模板 | editor/admin 维护，所有用户可选用 |
| `2` | 用户可复用模板 | 用户从文档导出的个人模板库 |
| `3` | 用户公开模板 | 预留，未实现 |

### 模板生成模式（generation_mode）

| 值 | 名称 | 行为 |
|---|---|---|
| `0` | 复制模式 | 变量替换 content_template，不调用 AI |
| `1` | AI 生成 | 按 sources 装配上下文，调用 AI 生成 |
| `2` | 直接使用 | content_template 原文直接写入 |
| `3` | AI 修改 | 以 content_template 为草稿，AI 润色 |

mode=1/3 失败时自动降级到 mode=0，`degraded=true` 标记，`generation_error` 包含详细错误信息。

### 变更状态标记

| 实体 | 字段 | 值 | 含义 |
|------|------|-----|------|
| 段落 | `ischange` | `0/1` | 无变更 / 已修改 |
| 摘要 | `is_change` | `0` | 无变更 |
| 摘要 | `is_change` | `1` | 用户手动修改 |
| 摘要 | `is_change` | `2` | 上游联动已更新 |
| 摘要 | `is_change` | `3` | AI 重新生成建议（待用户确认） |
| 核心信息 | `is_change` | `0/1` | 无变更 / 已修改 |

---

## 注意事项

1. **pgvector 必须在建表前启用**，否则 `literature_chunks` 表创建失败
2. **DashScope embedding 接口需单独开通**，与对话接口是不同的计费项
3. `.env` 不提交到版本库（已在 `.gitignore` 中排除）
4. 数据库迁移通过 `sql/migrate_*.sql` 手动执行，无自动迁移工具
5. PDF 导出依赖 GTK 运行时（Windows 需额外安装），开发环境可跳过
6. 生产环境建议 `AI_TIMEOUT_SECONDS=60`，根据并发量调整 `AI_MAX_CONCURRENCY`
