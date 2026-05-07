# InteractiveDocs Backend

基于 FastAPI 的交互式文档写作系统后端服务。

## 技术栈

- **框架**: FastAPI + Uvicorn
- **数据库**: PostgreSQL 14+ + pgvector
- **ORM**: SQLAlchemy (Async)
- **AI**: DashScope（通义千问）
- **文件存储**: 本地磁盘 / 阿里云 OSS
- **实时通信**: SSE + Redis

## 核心功能

- 文档管理（创建、编辑、快照、导出）
- 章节树形结构（拖拽排序、多级嵌套）
- 段落编辑（Markdown、AI 辅助）
- 摘要与核心信息管理
- 模板系统（系统模板、用户模板、AI 生成）
- 文献知识库（PDF 上传、向量检索、RAG）
- AI 对话助手（SSE 流式）
- 依赖追踪与变更联动

## 快速开始

### 1. 环境要求

- Python 3.10+
- PostgreSQL 14+ (必须安装 pgvector 扩展)
- Redis 5+ (可选，用于 SSE 事件总线)

### 2. 安装 pgvector

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# macOS
brew install pgvector

# 在数据库中启用
psql -U postgres -d interactivedocs -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. 创建数据库

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE interactivedocs;"

# 初始化表结构
psql -U postgres -d interactivedocs -f sql/database.sql
```

### 4. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/interactivedocs

# Redis (可选)
REDIS_URL=redis://localhost:6379/5

# 文件存储
STORAGE_BACKEND=local  # 或 oss

# 通义千问 AI
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=qwen-plus
AI_MAX_CONCURRENCY=5
```

### 5. 安装依赖并启动

```bash
pip install -r requirements.txt
python main.py
```

服务启动后访问：
- API 文档: http://localhost:8001/docs
- 健康检查: http://localhost:8001/

## 项目结构

```
backend/
├── api/v1/              # API 路由层
│   ├── auth.py          # 认证
│   ├── documents.py     # 文档
│   ├── chapters.py      # 章节
│   ├── paragraphs.py    # 段落
│   ├── summaries.py     # 摘要
│   ├── core_info.py     # 核心信息
│   ├── templates.py     # 模板
│   ├── literature.py    # 文献
│   ├── ai.py            # AI 对话
│   └── admin/           # 管理后台
├── core/                # 核心组件
│   ├── auth.py          # 鉴权
│   ├── config.py        # 配置
│   ├── constants.py     # 常量
│   └── response.py      # 响应格式
├── db/
│   ├── models.py        # ORM 模型
│   └── mappers/         # 数据访问层
├── schemas/             # Pydantic 模型
├── services/            # 业务逻辑层
└── main.py              # 应用入口
```

## 开发规范

详见 `.kiro/steering/backend-conventions.md`

**核心原则**：
- 路由层只做参数解析和响应组装
- Service 层负责业务逻辑和事务控制
- Mapper 层只做数据读写，不写业务判断
- Commit 权归 Service 层

## 文献知识库

### 工作流程

1. 上传 PDF → 存储（本地/OSS）
2. 后台异步处理：
   - PyPDFLoader 解析全文
   - RecursiveCharacterTextSplitter 分块
   - DashScope embedding 向量化
   - 写入 literature_chunks (pgvector)
3. AI 生成时自动 RAG 检索相关片段
4. 解析引用标记 [1][2] 并记录到 document_citations

### 文献权限

| scope | 上传者 | 可见范围 | 可删改 |
|---|---|---|---|
| public | editor/admin | 所有用户 | editor/admin |
| private | 普通用户 | 仅上传者 | 仅上传者 |

## 模板系统

### 模板类型

| 值 | 名称 | 说明 |
|---|---|---|
| 0 | 文档私有副本 | 创建文档时自动深拷贝 |
| 1 | 系统模板 | editor/admin 维护 |
| 2 | 用户可复用模板 | 用户导出的个人模板 |

### 生成模式

| 值 | 名称 | 行为 |
|---|---|---|
| 0 | 复制 | 变量替换，不调用 AI |
| 1 | AI 生成 | 调用 AI 生成内容 |
| 2 | 直接使用 | 原文直接写入 |
| 3 | AI 修改 | AI 润色草稿 |

mode=1/3 失败时自动降级到 mode=0。

## API 概览

### 认证

```
POST   /api/v1/auth/register      注册
POST   /api/v1/auth/login          登录
GET    /api/v1/auth/me             当前用户信息
```

### 文档

```
POST   /api/v1/documents           创建文档
GET    /api/v1/documents           文档列表
GET    /api/v1/documents/{id}      文档详情
PUT    /api/v1/documents/{id}      更新文档
DELETE /api/v1/documents/{id}      删除文档
GET    /api/v1/documents/{id}/full-content  全量内容
POST   /api/v1/documents/{id}/apply-*-template  应用模板
GET    /api/v1/documents/{id}/export/{format}   导出 (docx/pdf/md)
```

### 文献

```
POST   /api/v1/literature          上传 PDF
GET    /api/v1/literature          文献列表
PUT    /api/v1/literature/{id}     更新元数据
DELETE /api/v1/literature/{id}     删除文献
POST   /api/v1/templates/{id}/literature/{lit_id}  绑定文献
```

### 模板

```
GET    /api/v1/templates           模板列表
POST   /api/v1/templates           创建模板
GET    /api/v1/templates/{id}      模板详情
GET    /api/v1/templates/{id}/export  导出 JSON
POST   /api/v1/templates/import    导入 JSON
```

### AI

```
POST   /api/v1/ai/chat             AI 对话 (SSE 流式)
GET    /api/v1/documents/{id}/events  文档变更事件 (SSE)
```

## 响应格式

```json
// 成功
{ "code": 200, "message": "成功", "data": {} }

// 错误
{ "code": 404, "message": "文档不存在", "data": null }
```

## 常见问题

**Q: 文献上传后一直 pending/processing？**

检查：
1. DashScope API Key 是否有效（embedding 接口需单独开通）
2. pgvector 扩展是否已启用
3. 后端日志中的错误信息

**Q: AI 生成内容没有引用标记？**

检查：
1. 文献是否已绑定到模板
2. 文献 upload_status 是否为 ready
3. 后端日志中的 RAG 注入信息

**Q: PDF 导出失败？**

PDF 导出依赖 GTK 运行时，开发环境可跳过。

## 注意事项

1. pgvector 必须在建表前启用
2. DashScope embedding 接口需单独开通
3. `.env` 不提交到版本库
4. 生产环境建议调整 AI_MAX_CONCURRENCY 根据并发量

