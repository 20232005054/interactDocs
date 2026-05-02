# InteractiveDocs

AI 驱动的交互式文档写作系统，支持模板化生成、文献知识库 RAG、依赖追踪与智能联动。

## 项目简介

InteractiveDocs 是一个面向学术写作和技术文档的智能编辑平台，通过模板系统、AI 辅助和文献知识库，帮助用户高效创建结构化文档。

### 核心特性

- **模板驱动生成** - 系统模板与用户模板，支持 AI 生成与变量替换
- **文献知识库** - PDF 上传、向量检索、RAG 注入、自动引用
- **依赖追踪** - 核心信息、摘要、段落之间的依赖关系与变更联动
- **AI 对话助手** - 基于文档上下文的智能问答（SSE 流式）
- **实时协同** - SSE 事件推送，多端同步
- **版本管理** - 文档快照与恢复
- **多格式导出** - Word、PDF、Markdown

## 技术架构

### 后端

- **框架**: FastAPI + Uvicorn
- **数据库**: PostgreSQL 14+ + pgvector
- **ORM**: SQLAlchemy (Async)
- **AI**: DashScope（通义千问）
- **文件存储**: 本地磁盘 / 阿里云 OSS
- **实时通信**: SSE + Redis

### 前端

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **状态管理**: Zustand

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (必须安装 pgvector 扩展)
- Redis 5+ (可选)

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/InteractiveDocs.git
cd InteractiveDocs
```

### 2. 后端设置

```bash
cd backend

# 安装 pgvector
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector
# macOS
brew install pgvector

# 创建数据库
psql -U postgres -c "CREATE DATABASE interactivedocs;"
psql -U postgres -d interactivedocs -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 初始化表结构
psql -U postgres -d interactivedocs -f sql/database.sql

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库连接、AI API Key 等

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端服务启动在 http://localhost:8001

### 3. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8001" > .env.local

# 启动开发服务器
npm run dev
```

前端应用启动在 http://localhost:3000

### 4. 访问应用

1. 打开浏览器访问 http://localhost:3000
2. 注册账号并登录
3. 创建第一个文档

## 项目结构

```
InteractiveDocs/
├── backend/              # 后端服务
│   ├── api/v1/           # API 路由
│   ├── core/             # 核心组件
│   ├── db/               # 数据库模型与访问层
│   ├── schemas/          # Pydantic 模型
│   ├── services/         # 业务逻辑层
│   ├── sql/              # SQL 脚本
│   └── main.py           # 应用入口
├── frontend/             # 前端应用
│   └── src/
│       ├── app/          # Next.js 页面
│       ├── components/   # UI 组件
│       ├── containers/   # 容器组件
│       ├── services/     # API 调用
│       ├── store/        # 状态管理
│       └── hooks/        # 自定义 hooks
├── .kiro/                # 开发规范与文档
│   └── steering/
│       ├── architecture.md              # 架构说明
│       ├── backend-conventions.md       # 后端规范
│       ├── frontend-conventions.md      # 前端规范
│       └── error-handling-strategy.md   # 错误处理策略
└── README.md
```

## 核心概念

### 模板系统

模板分为三层：
- **核心信息模板** - 定义文档全局变量（树形结构）
- **摘要模板** - 定义文档摘要字段（平铺结构）
- **结构模板** - 定义章节结构（树形结构）

创建文档时，系统会深拷贝选定的模板，生成文档私有副本。

### 生成模式

| 模式 | 说明 |
|---|---|
| 复制 | 变量替换，不调用 AI |
| AI 生成 | 调用 AI 生成内容 |
| 直接使用 | 原文直接写入 |
| AI 修改 | AI 润色草稿 |

AI 生成失败时自动降级到复制模式。

### 文献知识库

1. 上传 PDF 文献
2. 后台自动解析、分块、向量化（pgvector）
3. AI 生成时自动 RAG 检索相关片段
4. 解析引用标记 [1][2] 并记录

### 依赖追踪

系统维护实体间的依赖关系：
- 段落 → 摘要
- 摘要 → 核心信息
- 摘要 → 摘要
- 章节 → 摘要/核心信息

修改上游实体时，自动触发下游重新生成。

## 开发规范

项目遵循严格的开发规范，详见 `.kiro/steering/` 目录：

- **架构说明** - `architecture.md`
- **后端规范** - `backend-conventions.md`
- **前端规范** - `frontend-conventions.md`
- **错误处理** - `error-handling-strategy.md`

### 后端核心原则

- 路由层只做参数解析和响应组装
- Service 层负责业务逻辑和事务控制
- Mapper 层只做数据读写
- Commit 权归 Service 层

### 前端核心原则

- `app/` 只放路由页面，不写业务逻辑
- 所有接口调用经过 `services/` 层
- 只用 Tailwind 类名，不写独立 CSS
- 错误处理遵循统一策略

## API 文档

后端启动后访问 Swagger 文档：http://localhost:8001/docs

### 主要接口

```
# 认证
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

# 文档
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/{id}
GET    /api/v1/documents/{id}/full-content
POST   /api/v1/documents/{id}/apply-*-template
GET    /api/v1/documents/{id}/export/{format}

# 文献
POST   /api/v1/literature
GET    /api/v1/literature
POST   /api/v1/templates/{id}/literature/{lit_id}

# 模板
GET    /api/v1/templates
POST   /api/v1/templates
GET    /api/v1/templates/{id}/export
POST   /api/v1/templates/import

# AI
POST   /api/v1/ai/chat
GET    /api/v1/documents/{id}/events
```

## 部署

### Docker Compose (推荐)

```bash
# 配置环境变量
cp .env.docker.example .env.docker
# 编辑 .env.docker

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 手动部署

#### 后端

```bash
cd backend
pip install -r requirements.txt
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

#### 前端

```bash
cd frontend
npm run build
npm run start
# 或使用 PM2
pm2 start npm --name "interactivedocs-frontend" -- start
```

## 常见问题

### 后端

**Q: 文献上传后一直 pending？**

检查：
1. DashScope API Key 是否有效（embedding 接口需单独开通）
2. pgvector 扩展是否已启用
3. 后端日志中的错误信息

**Q: AI 生成失败？**

检查：
1. DashScope API Key 额度是否充足
2. AI_MAX_CONCURRENCY 是否设置过高
3. 网络连接是否正常

### 前端

**Q: 页面刷新后 token 丢失？**

token 存储在 localStorage，检查浏览器是否禁用了本地存储。

**Q: SSE 连接频繁断开？**

检查后端日志，SSE 会自动重连（指数退避）。

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

- 项目主页: https://github.com/yourusername/InteractiveDocs
- 问题反馈: https://github.com/yourusername/InteractiveDocs/issues

## 致谢

- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [pgvector](https://github.com/pgvector/pgvector)
- [DashScope](https://dashscope.aliyun.com/)

## 写在最后

- 还有很多不足，在这项目上学习到了很多，以后一起进步
