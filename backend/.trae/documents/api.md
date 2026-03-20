# Backend API 文档

本文档描述 InteractiveDocs 后端服务的 RESTful API 接口，基于 FastAPI 框架实现。

## 1. 基础信息

- **框架**: FastAPI
- **接口前缀**: `/api/v1`
- **健康检查**: `GET /`
- **API 文档**: 启动后访问 `/docs` (Swagger UI)

### 1.1 统一响应格式

所有普通接口返回统一格式：

```json
{
  "code": 200,
  "message": "成功",
  "data": {}
}
```

异常响应格式：

```json
{
  "code": 404,
  "message": "资源不存在",
  "data": null
}
```

### 1.2 流式接口格式

AI 相关接口使用 SSE (Server-Sent Events) 格式返回：

```
data: {"content":"..."}

data: {"response":"..."}

data: [DONE]
```

---

## 2. 文档管理 (Documents)

**路由前缀**: `/api/v1/documents`

### 2.1 创建文档

- **接口**: `POST /api/v1/documents`
- **请求体**:

```json
{
  "title": "方案标题",
  "purpose": "使用目的",
  "template_id": "UUID"
}
```

- **说明**: 
  - `template_id` 必须指向已存在的模板
  - 创建文档时会复制模板，生成新的用户模板并绑定到文档

### 2.2 获取文档列表

- **接口**: `GET /api/v1/documents?page=1&page_size=10`
- **响应**:

```json
{
  "total": 100,
  "items": [
    {
      "document_id": "UUID",
      "title": "文档标题",
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-01T00:00:00"
    }
  ]
}
```

### 2.3 获取文档详情

- **接口**: `GET /api/v1/documents/{document_id}`
- **响应**:

```json
{
  "document_id": "UUID",
  "title": "文档标题",
  "content": {},
  "purpose": "使用目的",
  "template_id": "UUID",
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

### 2.4 更新文档

- **接口**: `PUT /api/v1/documents/{document_id}`
- **请求体** (字段均为可选):

```json
{
  "title": "新标题",
  "purpose": "新用途",
  "template_id": "UUID"
}
```

### 2.5 删除文档

- **接口**: `DELETE /api/v1/documents/{document_id}`

### 2.6 获取文档章节列表

- **接口**: `GET /api/v1/documents/documents/{document_id}/chapters`
- **说明**: 注意路径中包含重复的 `documents`

### 2.7 全局变量管理

全局变量存储在 `documents.content.global_variables` 中。

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/documents/{document_id}/global-variables` | GET | 获取全局变量列表 |
| `/api/v1/documents/{document_id}/global-variables` | PUT | 批量更新全局变量 |
| `/api/v1/documents/{document_id}/global-variables` | POST | 添加单个全局变量 |
| `/api/v1/documents/{document_id}/global-variables/{order_index}` | PUT | 更新单个全局变量 |
| `/api/v1/documents/{document_id}/global-variables/{order_index}` | DELETE | 删除全局变量 |

**全局变量结构**:

```json
{
  "key": "变量名",
  "value": "变量值",
  "type": "string",
  "description": "变量说明",
  "is_locked": false,
  "order_index": 0
}
```

### 2.8 快照管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/documents/{document_id}/snapshots` | GET | 获取快照列表 |
| `/api/v1/documents/{document_id}/snapshots/detail/{snapshot_id}` | GET | 获取快照详情 |
| `/api/v1/documents/{document_id}/snapshots` | POST | 创建快照 |
| `/api/v1/documents/snapshots/{snapshot_id}` | PUT | 更新快照描述 |

---

## 3. 章节管理 (Chapters)

**路由前缀**: `/api/v1`

### 3.1 获取章节详情

- **接口**: `GET /api/v1/chapters/{chapter_id}`
- **响应**: 包含章节基本信息和段落列表

### 3.2 更新章节

- **接口**: `PUT /api/v1/chapters/{chapter_id}`
- **请求体**:

```json
{
  "title": "章节标题",
  "status": 1
}
```

- **状态说明**: `0` = 编辑中, `1` = 已完成

### 3.3 创建章节

- **接口**: `POST /api/v1/chapters/{document_id}`
- **说明**: 
  - 使用默认标题创建
  - `order_index` 自动追加到文档末尾

### 3.4 删除章节

- **接口**: `DELETE /api/v1/chapters/{chapter_id}`

### 3.5 获取章节目录

- **接口**: `GET /api/v1/chapters/{chapter_id}/toc`
- **说明**: 提取 `heading-1` 到 `heading-6` 类型的段落作为目录

### 3.6 从摘要生成章节内容

- **接口**: `POST /api/v1/chapters/{chapter_id}/generate-content`
- **返回**: SSE 流式响应

---

## 4. 段落管理 (Paragraphs)

**路由前缀**: `/api/v1`

### 4.1 获取段落详情

- **接口**: `GET /api/v1/paragraphs/{paragraph_id}`

### 4.2 创建段落

- **接口**: `POST /api/v1/chapters/{chapter_id}/paragraphs`
- **请求体**:

```json
{
  "content": "段落内容"
}
```

- **说明**: 新段落类型默认为 `paragraph`，`order_index` 自动追加

### 4.3 更新段落

- **接口**: `PUT /api/v1/paragraphs/{paragraph_id}`
- **可更新字段**:
  - `content`: 内容
  - `para_type`: 段落类型
  - `order_index`: 排序索引
  - `ai_eval`: AI 评估
  - `ai_suggestion`: AI 建议
  - `ai_generate`: AI 生成内容
  - `ischange`: 变更标记

### 4.4 删除段落

- **接口**: `DELETE /api/v1/paragraphs/{paragraph_id}`
- **说明**: 删除后自动重排同章节下后续段落的 `order_index`

### 4.5 在指定段落后插入新段落

- **接口**: `POST /api/v1/paragraphs/{paragraph_id}/insert-after`

### 4.6 获取章节段落列表

- **接口**: `GET /api/v1/chapters/{chapter_id}/paragraphs`

### 4.7 段落类型

| 类型 | 说明 |
|------|------|
| `paragraph` | 正文 |
| `heading-1` | 一级标题 |
| `heading-2` | 二级标题 |
| `heading-3` | 三级标题 |
| `heading-4` | 四级标题 |
| `heading-5` | 五级标题 |
| `heading-6` | 六级标题 |

### 4.8 AI 辅助功能

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/paragraphs/{paragraph_id}/ai/assist` | POST | AI 帮填段落内容 (仅 `paragraph` 类型) |
| `/api/v1/paragraphs/{paragraph_id}/ai/evaluate` | POST | AI 评估段落内容 |
| `/api/v1/paragraphs/{paragraph_id}/ai/apply` | POST | 应用 AI 帮填结果 |

### 4.9 获取段落关联信息

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/paragraphs/{paragraph_id}/summaries` | GET | 获取关联摘要 |
| `/api/v1/paragraphs/{paragraph_id}/keywords` | GET | 获取关联关键词 |

---

## 5. 摘要管理 (Summaries)

**路由前缀**: `/api/v1`

### 5.1 创建摘要

- **接口**: `POST /api/v1/documents/{document_id}/summaries`
- **说明**: 创建默认摘要，标题为"新摘要"，内容为空

### 5.2 获取摘要详情

- **接口**: `GET /api/v1/summaries/{summary_id}`

### 5.3 获取文档摘要列表

- **接口**: `GET /api/v1/documents/{document_id}/summaries`

### 5.4 更新摘要

- **接口**: `PUT /api/v1/summaries/{summary_id}`
- **请求体**:

```json
{
  "title": "摘要标题",
  "content": "摘要内容"
}
```

### 5.5 删除摘要

- **接口**: `DELETE /api/v1/summaries/{summary_id}`

### 5.6 在指定摘要后插入新摘要

- **接口**: `POST /api/v1/summaries/{summary_id}/insert-after`

### 5.7 获取摘要关联信息

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/summaries/{summary_id}/paragraphs` | GET | 获取关联段落 |
| `/api/v1/summaries/{summary_id}/keywords` | GET | 获取关联关键词 |

### 5.8 AI 辅助功能

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/documents/{document_id}/summaries/ai/generate` | POST | AI 一键生成所有摘要 |
| `/api/v1/summaries/{summary_id}/ai/assist` | POST | AI 帮填单个摘要 |
| `/api/v1/summaries/{summary_id}/ai/apply` | POST | 应用 AI 帮填结果 |

**AI 帮填场景**:
- 场景1: 无标题无内容 → AI 帮填标题和内容
- 场景2: 有标题无内容 → AI 只填内容
- 场景3: 无标题有内容 → AI 帮填标题

---

## 6. 关键词管理 (Keywords)

**路由前缀**: `/api/v1`

### 6.1 创建关键词

- **接口**: `POST /api/v1/documents/{document_id}/keywords`
- **请求体**:

```json
{
  "keyword": "关键词"
}
```

### 6.2 获取关键词详情

- **接口**: `GET /api/v1/keywords/{keyword_id}`

### 6.3 获取文档关键词列表

- **接口**: `GET /api/v1/documents/{document_id}/keywords`

### 6.4 更新关键词

- **接口**: `PUT /api/v1/keywords/{keyword_id}`

### 6.5 删除关键词

- **接口**: `DELETE /api/v1/keywords/{keyword_id}`

### 6.6 AI 生成关键词

- **接口**: `POST /api/v1/documents/{document_id}/keywords/ai/assist`

---

## 7. 模板管理 (Templates)

**路由前缀**: `/api/v1/templates`

### 7.1 创建模板

- **接口**: `POST /api/v1/templates/`
- **参数**:
  - `purpose`: 用途
  - `display_name`: 显示名称
  - `content`: 模板内容 (JSON)
  - `is_system`: 是否为系统模板
  - `user_id`: 用户ID (可选)

### 7.2 获取模板详情

- **接口**: `GET /api/v1/templates/{template_id}`

### 7.3 获取模板列表

- **接口**: `GET /api/v1/templates/?purpose=...&is_system=...&is_active=...`

### 7.4 管理员更新模板

- **接口**: `PUT /api/v1/templates/{template_id}`
- **说明**: 
  - 传入 `content` 会创建新版本，旧版本设为 `is_active=false`
  - 只更新其他字段则在原记录上修改

### 7.5 删除模板

- **接口**: `DELETE /api/v1/templates/{template_id}`

### 7.6 用户更新模板内容

- **接口**: `PUT /api/v1/templates/{template_id}/content`
- **说明**: 
  - 仅修改 `content` 字段，不更新版本
  - 系统模板不可调用

### 7.7 获取用途列表

- **接口**: `GET /api/v1/templates/purposes/list?is_system=true`

### 7.8 按用途获取模板

- **接口**: `GET /api/v1/templates/by-purpose/{purpose}?is_system=...&is_active=...`

### 7.9 模板回滚

- **接口**: `POST /api/v1/templates/rollback/{template_id}`
- **说明**: 将模板内容回滚到对应的系统模板版本

---

## 8. AI 对话

**路由前缀**: `/api/v1/ai`

### 8.1 AI 聊天

- **接口**: `POST /api/v1/ai/chat`
- **请求体**:

```json
{
  "message": "请帮我优化本章节结构",
  "document_id": "UUID",
  "current_chapter_id": "UUID",
  "selected_paragraphs": [],
  "selected_keywords": [],
  "selected_summaries": []
}
```

- **返回**: SSE 流式响应
- **说明**: 
  - 加载最近 5 条聊天记录作为上下文
  - 若输出包含 `[ACTION]{...}`，会解析为 `actions` 字段返回

---

## 9. 辅助接口

**路由前缀**: `/api/v1`

### 9.1 获取操作历史

- **接口**: `GET /api/v1/history?page=1&page_size=10`

### 9.2 获取依赖关系

- **接口**: `GET /api/v1/dependencies/{entity_type}/{entity_id}`
- **entity_type** 可选值:
  - `paragraph`: 段落
  - `summary`: 摘要
  - `keyword`: 关键词
- **响应**:

```json
{
  "upstream": [],
  "downstream": []
}
```

---

## 10. 核心实现说明

### 10.1 响应包装

所有普通接口都经过 `success_response` 包装，HTTP 状态通常为 200，业务错误通过 `code/message` 表示。

### 10.2 模板复制机制

创建文档时不会直接复用传入模板，而是复制出一份新的用户模板，文档绑定到新模板。

### 10.3 依赖关系追踪

系统通过 `dependency_edges` 表追踪实体间关系：
- 段落生成时使用了哪些摘要
- 段落或摘要命中了哪些关键词
- 某个摘要被哪些段落依赖

### 10.4 变更传播

段落、摘要、关键词更新后会判断是否发生"实质变化"，必要时标记相关联的上游或下游内容需要更新。

### 10.5 状态标记

| 实体 | 字段 | 值 | 含义 |
|------|------|-----|------|
| 段落 | `ischange` | 0 | 无待处理变更 |
| 段落 | `ischange` | 1 | 段落自身发生实质修改 |
| 段落 | `ischange` | 2 | 上游摘要变化，段落需要刷新 |
| 摘要 | `is_change` | 0 | 无待处理变更 |
| 摘要 | `is_change` | 1 | 摘要自身发生实质修改 |
| 摘要 | `is_change` | 3 | 下游段落变化，摘要需要重新审视 |
