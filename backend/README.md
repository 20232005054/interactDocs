

# 方案生成系统后端

基于 FastAPI 的方案生成系统后端服务，提供文档管理、章节管理、段落管理、摘要管理、关键词管理等功能，并集成 AI 辅助写作能力。

## 项目简介

方案生成系统是一款面向文档写作场景的智能化工具，通过 AI 技术辅助用户生成方案框架、填写段落内容、评估文本质量、修订文档内容。系统采用 RESTful API 架构，支持异步操作，提供完整的 CRUD 接口和 AI 智能交互功能。

## 技术栈

- **Web 框架**: FastAPI
- **数据库 ORM**: SQLAlchemy (异步)
- **数据库**: 支持 MySQL/PostgreSQL
- **认证**: JWT Token
- **AI 集成**: 通义千问 (Qwen) API

## 主要功能模块

### 1. 文档管理
- 创建、获取、更新、删除文档
- 生成方案结构
- 文档快照管理
- 操作历史记录

### 2. 章节管理
- 章节的增删改查
- 批量创建章节
- 章节内容目录 (TOC) 获取
- 从摘要生成正文章节

### 3. 段落管理
- 段落的增删改查
- 批量创建段落
- 批量更新段落顺序

### 4. 摘要管理
- 摘要的增删改查
- 摘要与段落关联管理
- 批量创建摘要
- 批量更新摘要顺序

### 5. 关键词管理
- 关键词的增删改查
- 关键词与摘要/段落关联管理
- 批量创建关键词

### 6. AI 智能功能
- **AI 帮填**: 根据上下文智能填写段落、摘要、关键词内容
- **AI 评估**: 评估段落内容的质量和适配度
- **AI 修订**: 对选定内容进行智能修订
- **AI 对话**: 与 AI 助理实时对话，获取写作建议

### 7. 辅助功能
- 获取生成方案元数据
- 获取使用教程
- 获取操作历史记录
- 文档快照管理

## 项目结构

```
backend/
├── api/v1/                    # API 路由层
│   ├── ai.py                  # AI 功能接口
│   ├── chapters.py            # 章节管理接口
│   ├── documents.py           # 文档管理接口
│   ├── endpoints.py           # 辅助功能接口
│   ├── keywords.py            # 关键词管理接口
│   └── summaries.py           # 摘要管理接口
├── core/                      # 核心功能
│   └── response.py            # 响应格式化
├── db/                        # 数据库层
│   ├── mappers/               # 数据映射器
│   │   ├── chapter_mapper.py
│   │   ├── document_mapper.py
│   │   ├── keyword_mapper.py
│   │   ├── paragraph_mapper.py
│   │   └── summary_mapper.py
│   ├── models.py              # SQLAlchemy 模型
│   └── session.py             # 数据库会话
├── schemas/                   # Pydantic 数据模型
│   └── schemas.py
├── services/                  # 业务逻辑层
│   ├── ai_service.py          # AI 服务
│   ├── chapter_service.py     # 章节服务
│   ├── document_service.py   # 文档服务
│   ├── keyword_service.py    # 关键词服务
│   ├── paragraph_service.py  # 段落服务
│   └── summary_service.py    # 摘要服务
├── main.py                    # 应用入口
└── test.py                    # 测试脚本
```

## 快速开始

### 环境要求

- Python 3.8+
- MySQL 5.7+ 或 PostgreSQL 12+

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置数据库

在项目根目录创建 `.env` 文件，配置数据库连接信息：

```env
DATABASE_URL=mysql+aiomysql://username:password@host:port/database
# 或使用 PostgreSQL
# DATABASE_URL=postgresql+asyncpg://username:password@host:port/database
```

### 初始化数据库

```bash
python check_db.py
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问 `http://localhost:8000/docs` 查看 API 文档（Swagger UI）。

## API 文档

详细的接口规范请参考 `.trae/documents/api.md`。

主要接口包括：

| 模块 | 接口路径 | 说明 |
|------|----------|------|
| 文档 | POST /api/v1/documents | 创建文档 |
| 文档 | GET /api/v1/documents/{id} | 获取文档详情 |
| 章节 | POST /api/v1/chapters | 创建章节 |
| 段落 | POST /api/v1/chapters/{id}/paragraphs | 创建段落 |
| 摘要 | POST /api/v1/summaries | 创建摘要 |
| 关键词 | POST /api/v1/keywords | 创建关键词 |
| AI | POST /api/v1/ai/chat | AI 对话 |
| AI | POST /api/v1/ai/revision | AI 修订 |

## 许可证

本项目仅供学习交流使用。