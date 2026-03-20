# 数据库设计文档

本文档描述 InteractiveDocs 后端服务的数据库结构设计，基于 PostgreSQL 实现。

## 1. 数据库概览

- **数据库**: PostgreSQL
- **Schema**: `public`
- **主键策略**: UUID (`gen_random_uuid()`)
- **主要字段类型**: `uuid`, `jsonb`, `text`, `varchar`, `integer`, `boolean`, `timestamp`
- **连接配置**: `postgresql+asyncpg://postgres:123456@localhost:5432/agent01`

### 1.1 自动更新机制

数据库通过触发器自动维护 `updated_at` 字段：

```sql
-- 更新函数
public.update_updated_at_column()
```

已挂载触发器的表：
- `chapters`
- `documents`
- `users`

---

## 2. 核心数据表

### 2.1 users (用户表)

存储系统用户信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `user_id` | uuid | PK, DEFAULT gen_random_uuid() | 用户唯一标识 |
| `email` | varchar(255) | NOT NULL, UNIQUE | 邮箱 |
| `password_hash` | varchar(255) | NOT NULL | 密码哈希 |
| `name` | varchar(100) | NOT NULL | 用户名 |
| `role` | varchar(20) | DEFAULT 'user' | 角色 (user/admin) |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 2.2 templates (模板表)

存储系统模板和用户模板，支持版本管理。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `template_id` | uuid | PK, DEFAULT gen_random_uuid() | 模板唯一标识 |
| `group_id` | uuid | NOT NULL | 逻辑分组ID，同组模板的不同版本共享 |
| `purpose` | varchar(50) | NOT NULL | 用途大类 |
| `display_name` | varchar(100) | NOT NULL | 显示名称 |
| `content` | jsonb | NOT NULL | 模板内容 |
| `version` | integer | DEFAULT 1 | 版本号 |
| `is_system` | boolean | DEFAULT false | 是否为系统模板 |
| `user_id` | uuid | FK → users | 所属用户 |
| `is_active` | boolean | DEFAULT true | 是否为当前生效版本 |
| `created_at` | timestamp | DEFAULT now() | 创建时间 |
| `updated_at` | timestamp | DEFAULT now() | 更新时间 |

**业务说明**:
- `group_id` 用于标识同一套模板的不同版本
- 创建文档时会复制模板，生成新的用户模板记录

### 2.3 documents (文档表)

存储文档主信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `document_id` | uuid | PK, DEFAULT gen_random_uuid() | 文档唯一标识 |
| `user_id` | uuid | FK → users | 所属用户 |
| `template_id` | uuid | FK → templates | 关联模板 |
| `title` | varchar(80) | NOT NULL | 文档标题 |
| `content` | jsonb | DEFAULT '[]' | 全局变量等配置 |
| `purpose` | varchar(50) | NULL | 使用目的 |
| `snapshot_cursor` | integer | DEFAULT 0 | 快照计数器 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**content 结构示例**:

```json
{
  "global_variables": [
    {
      "key": "变量名",
      "value": "变量值",
      "type": "string",
      "description": "变量说明",
      "is_locked": false,
      "order_index": 0
    }
  ]
}
```

### 2.4 chapters (章节表)

存储文档章节信息，支持树形结构。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `chapter_id` | uuid | PK, DEFAULT gen_random_uuid() | 章节唯一标识 |
| `document_id` | uuid | FK → documents, ON DELETE CASCADE | 所属文档 |
| `parent_id` | uuid | FK → chapters, ON DELETE SET NULL | 父章节ID |
| `title` | varchar(200) | NOT NULL, DEFAULT '' | 章节标题 |
| `status` | integer | DEFAULT 0 | 状态: 0-编辑中, 1-已完成 |
| `order_index` | integer | NOT NULL, DEFAULT 0 | 排序索引 |
| `updated_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**关系**:
- 一对多: `documents` → `chapters`
- 自关联: `chapters.parent_id` → `chapters.chapter_id`

### 2.5 paragraphs (段落表)

存储章节段落内容，是编辑和 AI 联动的核心实体。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `paragraph_id` | uuid | PK, DEFAULT gen_random_uuid() | 段落唯一标识 |
| `chapter_id` | uuid | FK → chapters, ON DELETE CASCADE | 所属章节 |
| `content` | text | NOT NULL | 段落内容 |
| `para_type` | varchar(20) | NOT NULL | 段落类型 |
| `order_index` | integer | NOT NULL | 排序索引 |
| `ai_eval` | text | NULL | AI 评估结果 |
| `ai_suggestion` | text | NULL | AI 修改建议 |
| `ai_generate` | text | NULL | AI 生成内容 |
| `ischange` | integer | NOT NULL, DEFAULT 0 | 变更状态标记 |

**para_type 枚举值**:
- `paragraph`: 正文
- `heading-1` ~ `heading-6`: 一级至六级标题

**ischange 状态说明**:
- `0`: 无待处理变更
- `1`: 段落自身发生实质修改
- `2`: 上游摘要变化，段落需要刷新

### 2.6 document_summaries (摘要表)

存储文档摘要信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `summary_id` | uuid | PK, DEFAULT gen_random_uuid() | 摘要唯一标识 |
| `document_id` | uuid | FK → documents, ON DELETE CASCADE | 所属文档 |
| `title` | varchar(200) | NOT NULL | 摘要标题 |
| `content` | text | NOT NULL | 摘要内容 |
| `version` | integer | NOT NULL, DEFAULT 1 | 版本号 |
| `is_change` | integer | NOT NULL, DEFAULT 0 | 变更状态标记 |
| `ai_generate` | text | NULL | AI 生成内容 |
| `order_index` | integer | NOT NULL, DEFAULT 0 | 排序索引 |
| `created_at` | timestamp | DEFAULT now() | 创建时间 |
| `updated_at` | timestamp | DEFAULT now() | 更新时间 |

**is_change 状态说明**:
- `0`: 无待处理变更
- `1`: 摘要自身发生实质修改
- `3`: 下游段落变化，摘要需要重新审视

### 2.7 document_keywords (关键词表)

存储文档关键词。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `keyword_id` | uuid | PK | 关键词唯一标识 |
| `document_id` | uuid | FK → documents, ON DELETE CASCADE | 所属文档 |
| `keyword` | text | NOT NULL | 关键词内容 |
| `version` | integer | NOT NULL, DEFAULT 1 | 版本号 |
| `created_at` | timestamp | DEFAULT now() | 创建时间 |
| `updated_at` | timestamp | DEFAULT now() | 更新时间 |

### 2.8 document_versions (文档快照表)

存储文档历史快照。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `version_id` | uuid | PK, DEFAULT gen_random_uuid() | 快照唯一标识 |
| `document_id` | uuid | FK → documents | 所属文档 |
| `description` | varchar(255) | NOT NULL | 快照描述 |
| `snapshot_data` | jsonb | NOT NULL | 快照数据 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `created_by` | uuid | FK → users | 创建用户 |

**snapshot_data 结构**: 包含章节和段落的完整结构

### 2.9 operation_history (操作历史表)

记录用户操作历史。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `history_id` | uuid | PK, DEFAULT gen_random_uuid() | 记录唯一标识 |
| `user_id` | uuid | FK → users | 操作用户 |
| `document_id` | uuid | FK → documents | 所属文档 |
| `chapter_id` | uuid | FK → chapters | 所属章节 |
| `action` | varchar(50) | NOT NULL | 操作类型 |
| `content_before` | jsonb | DEFAULT '[]' | 操作前内容 |
| `content_after` | jsonb | DEFAULT '[]' | 操作后内容 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 2.10 chat_records (AI 对话记录表)

存储 AI 聊天历史。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `chat_id` | uuid | PK, DEFAULT gen_random_uuid() | 记录唯一标识 |
| `user_id` | uuid | FK → users | 用户 |
| `document_id` | uuid | FK → documents | 所属文档 |
| `chapter_id` | uuid | FK → chapters | 当前章节 |
| `chapter_content` | jsonb | NULL | 章节上下文 |
| `message` | text | NOT NULL | 用户消息 |
| `response` | text | NOT NULL | AI 回复 |
| `mode` | varchar(20) | DEFAULT 'chat' | 对话模式 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 2.11 dependency_edges (依赖关系表)

统一依赖关系表，构建文档知识图谱的核心。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `edge_id` | uuid | PK, DEFAULT gen_random_uuid() | 边唯一标识 |
| `source_type` | varchar(30) | NOT NULL | 源实体类型 |
| `source_id` | uuid | NOT NULL | 源实体ID |
| `target_type` | varchar(30) | NOT NULL | 目标实体类型 |
| `target_id` | uuid | NOT NULL | 目标实体ID |
| `target_version` | integer | NULL | 依赖时的目标版本 |
| `relevance_score` | double precision | DEFAULT 1.0 | 关联权重 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**典型关系**:
- `paragraph` → `summary`: 段落依赖摘要
- `paragraph` → `keyword`: 段落关联关键词
- `summary` → `keyword`: 摘要关联关键词

### 2.12 历史记录表

#### document_summary_history (摘要历史)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `history_id` | uuid | PK, DEFAULT gen_random_uuid() | 记录唯一标识 |
| `summary_id` | uuid | FK → document_summaries | 所属摘要 |
| `version` | integer | NOT NULL | 版本号 |
| `title` | varchar(200) | NOT NULL | 历史标题 |
| `content` | text | NOT NULL | 历史内容 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### document_keyword_history (关键词历史)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `history_id` | uuid | PK, DEFAULT gen_random_uuid() | 记录唯一标识 |
| `keyword_id` | uuid | FK → document_keywords | 所属关键词 |
| `version` | integer | NOT NULL | 版本号 |
| `keyword` | text | NOT NULL | 历史关键词 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

## 3. 索引设计

### 3.1 主键索引

所有表的主键自动创建唯一索引。

### 3.2 外键索引

| 索引名 | 表 | 字段 | 说明 |
|--------|-----|------|------|
| `idx_chapters_document_id` | chapters | document_id | 文档章节查询 |
| `idx_chapters_parent_id` | chapters | parent_id | 父章节查询 |
| `idx_paragraphs_chapter_id` | paragraphs | chapter_id | 章节段落查询 |
| `idx_document_summaries_document_id` | document_summaries | document_id | 文档摘要查询 |
| `idx_document_keywords_document_id` | document_keywords | document_id | 文档关键词查询 |
| `idx_document_versions_document_id` | document_versions | document_id | 文档快照查询 |
| `idx_documents_template_id` | documents | template_id | 模板文档查询 |
| `idx_documents_user_id` | documents | user_id | 用户文档查询 |

### 3.3 业务索引

| 索引名 | 表 | 字段 | 说明 |
|--------|-----|------|------|
| `idx_chapters_order_index` | chapters | (document_id, order_index) | 章节排序 |
| `idx_paragraphs_order_index` | paragraphs | (chapter_id, order_index) | 段落排序 |
| `idx_documents_title` | documents | to_tsvector('english', title) | 标题全文检索 (GIN) |
| `idx_templates_group_id` | templates | group_id | 模板分组 |
| `idx_templates_purpose` | templates | purpose | 用途筛选 |
| `idx_templates_is_system` | templates | is_system | 系统模板筛选 |
| `idx_templates_is_active` | templates | is_active | 生效版本筛选 |

### 3.4 依赖关系索引

| 索引名 | 表 | 字段 | 说明 |
|--------|-----|------|------|
| `idx_dependency_edges_source` | dependency_edges | (source_type, source_id) | 源实体查询 |
| `idx_dependency_edges_target` | dependency_edges | (target_type, target_id) | 目标实体查询 |
| `idx_dependency_edges_created_at` | dependency_edges | created_at | 时间排序 |

### 3.5 历史记录索引

| 索引名 | 表 | 字段 | 说明 |
|--------|-----|------|------|
| `idx_document_summary_history_summary_id` | document_summary_history | summary_id | 摘要历史查询 |
| `idx_document_keyword_history_keyword_id` | document_keyword_history | keyword_id | 关键词历史查询 |
| `idx_operation_history_document_id` | operation_history | document_id | 文档操作历史 |
| `idx_operation_history_chapter_id` | operation_history | chapter_id | 章节操作历史 |

---

## 4. 关系模型

### 4.1 一对多关系

```
users ─┬─► documents
       ├─► templates
       ├─► chat_records
       ├─► operation_history
       └─► document_versions

documents ─┬─► chapters
           ├─► document_summaries
           ├─► document_keywords
           ├─► document_versions
           ├─► chat_records
           └─► operation_history

chapters ─┬─► paragraphs
          ├─► chat_records
          └─► operation_history

document_summaries ─► document_summary_history
document_keywords ─► document_keyword_history
```

### 4.2 自关联关系

```
chapters.parent_id ─► chapters.chapter_id
```

删除策略: `ON DELETE SET NULL`

### 4.3 多对多关系 (通过 dependency_edges)

```
paragraphs ◄──► summaries
paragraphs ◄──► keywords
summaries ◄──► keywords
```

---

## 5. 级联删除策略

### 5.1 CASCADE (级联删除)

| 父表 | 子表 | 删除行为 |
|------|------|----------|
| documents | chapters | 删除文档时级联删除所有章节 |
| documents | document_keywords | 删除文档时级联删除所有关键词 |
| documents | document_summaries | 删除文档时级联删除所有摘要 |
| chapters | paragraphs | 删除章节时级联删除所有段落 |
| document_keywords | document_keyword_history | 删除关键词时级联删除历史 |
| document_summaries | document_summary_history | 删除摘要时级联删除历史 |

### 5.2 SET NULL (置空)

| 父表 | 子表 | 字段 | 删除行为 |
|------|------|------|----------|
| chapters | chapters | parent_id | 父章节删除时子章节 parent_id 置空 |

---

## 6. 数据流转

### 6.1 创建文档流程

1. 根据 `template_id` 读取模板
2. 复制模板创建新的用户模板记录
3. 创建文档并绑定到新模板
4. 初始化 `snapshot_cursor = 0`

### 6.2 段落 AI 帮填流程

1. 读取段落、所属章节、所属文档
2. 收集层级标题、相关摘要、关键词
3. 调用大模型生成内容，结果写入 `paragraphs.ai_generate`
4. 将使用过的摘要和关键词登记到 `dependency_edges`

### 6.3 摘要 AI 帮填流程

1. 读取摘要和所属文档
2. 收集文档标题、用途、关键词
3. 生成摘要标题或内容
4. 将生成内容写入 `document_summaries.ai_generate`，等待用户应用

### 6.4 实质变更检测流程

1. 规范化文本比较
2. 通过长度变化和相似度快速筛查
3. 必要时调用 AI 判断是否构成实质修改
4. 若构成实质修改，标记相关上游或下游实体需要刷新

### 6.5 快照创建流程

1. 读取文档下所有章节和段落
2. 序列化结构到 `snapshot_data`
3. `snapshot_cursor` 自增
4. 生成默认描述 "快照{cursor}"

---

## 7. ER 图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │   documents     │     │    templates    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ PK user_id      │◄────┤ PK document_id  │────►│ PK template_id  │
│    email        │     │ FK user_id      │     │ FK user_id      │
│    name         │     │ FK template_id  │     │    group_id     │
│    role         │     │    title        │     │    purpose      │
│    created_at   │     │    content      │     │    content      │
│    updated_at   │     │    purpose      │     │    version      │
└─────────────────┘     │    snapshot_cursor    │    is_system    │
                        │    created_at   │     │    is_active    │
                        │    updated_at   │     │    created_at   │
                        └─────────────────┘     │    updated_at   │
                                │               └─────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    chapters     │     │document_summaries     │document_keywords│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ PK chapter_id   │     │ PK summary_id   │     │ PK keyword_id   │
│ FK document_id  │     │ FK document_id  │     │ FK document_id  │
│ FK parent_id    │     │    title        │     │    keyword      │
│    title        │     │    content      │     │    version      │
│    status       │     │    version      │     │    created_at   │
│    order_index  │     │    is_change    │     │    updated_at   │
│    updated_at   │     │    ai_generate  │     └─────────────────┘
└─────────────────┘     │    order_index  │              │
         │              │    created_at   │              │
         │              │    updated_at   │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   paragraphs    │     │document_summary_│     │document_keyword_│
├─────────────────┤     │    history      │     │    history      │
│ PK paragraph_id │     ├─────────────────┤     ├─────────────────┤
│ FK chapter_id   │     │ PK history_id   │     │ PK history_id   │
│    content      │     │ FK summary_id   │     │ FK keyword_id   │
│    para_type    │     │    version      │     │    version      │
│    order_index  │     │    title        │     │    keyword      │
│    ai_eval      │     │    content      │     │    created_at   │
│    ai_suggestion│     │    created_at   │     └─────────────────┘
│    ai_generate  │     └─────────────────┘
│    ischange     │
└─────────────────┘
         │
         │
         ▼
┌─────────────────┐
│dependency_edges │
├─────────────────┤
│ PK edge_id      │
│    source_type  │
│    source_id    │
│    target_type  │
│    target_id    │
│    target_version      │
│    relevance_score     │
│    created_at   │
└─────────────────┘
```

---

## 8. 代码与数据库差异说明

当前代码模型与数据库结构存在以下差异：

| 项目 | 数据库 | 代码 (ORM) | 建议 |
|------|--------|------------|------|
| `chapters.parent_id` | 存在 | 未定义 | 建议同步添加 |
| `operation_history.content_before/after` | jsonb | Text | 建议改为 JSONB |
| `documents.content` 默认值 | `'[]'` | - | 服务层按对象处理，建议统一 |
| `updated_at` 维护 | 数据库触发器 | ORM onupdate | 以数据库触发器为准 |
| `document_keywords.keyword_id` | 无默认值 | default=uuid.uuid4 | 注意主键初始化方式 |

---

## 9. 初始化建议

### 9.1 建表顺序

1. `users` (无依赖)
2. `templates` (依赖 users)
3. `documents` (依赖 users, templates)
4. `chapters` (依赖 documents, 自关联)
5. `paragraphs` (依赖 chapters)
6. `document_summaries` / `document_keywords` (依赖 documents)
7. `document_summary_history` / `document_keyword_history` (依赖 summaries/keywords)
8. `document_versions` / `chat_records` / `operation_history` (依赖 users, documents, chapters)
9. `dependency_edges` (无强外键，逻辑关联)

### 9.2 触发器创建

```sql
-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表挂载触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON chapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
