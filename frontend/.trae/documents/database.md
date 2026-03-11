# 方案生成系统数据库设计文档

## 1. 数据库概述

本数据库设计基于 PostgreSQL 数据库，用于存储方案生成系统的所有数据，包括用户信息、文档信息、章节结构、段落内容、文档版本、操作历史和聊天记录等。数据库采用关系型设计，确保数据的一致性和完整性。

## 2. 数据库表结构

### 2.1 用户表（`users`）

| 字段名             | 数据类型           | 约束                          | 描述                 |
| --------------- | -------------- | --------------------------- | ------------------ |
| `user_id`       | `UUID`         | `PRIMARY KEY`               | 用户 ID              |
| `email`         | `VARCHAR(255)` | `UNIQUE NOT NULL`           | 用户邮箱               |
| `password_hash` | `VARCHAR(255)` | `NOT NULL`                  | 哈希后的密码             |
| `name`          | `VARCHAR(100)` | `NOT NULL`                  | 用户姓名               |
| `role`          | `VARCHAR(20)`  | `DEFAULT 'user'`            | 用户角色（user 或 admin） |
| `created_at`    | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP` | 创建时间               |
| `updated_at`    | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP` | 更新时间               |

### 2.2 文档表（`documents`）

| 字段名               | 数据类型          | 约束                          | 描述                      |
| ----------------- | ------------- | --------------------------- | ----------------------- |
| `document_id`     | `UUID`        | `PRIMARY KEY`               | 文档 ID                   |
| `user_id`         | `UUID`        | `REFERENCES users(user_id)` | 创建用户 ID                 |
| `title`           | `VARCHAR(80)` | `NOT NULL`                  | 方案标题                    |
| `abstract`        | `TEXT`        | `NULL`                      | 摘要                      |
| `content`         | `JSONB`       | `DEFAULT '[]'`              | 参考正文（Block Schema格式）    |
| `purpose`         | `VARCHAR(50)` | `NULL`                      | 使用目的                    |
| `status`          | `VARCHAR(20)` | `DEFAULT 'draft'`           | 文档状态（draft 或 completed） |
| `snapshot_cursor` | `INTEGER`     | `DEFAULT 0`                 | 快照计数器，用于生成默认快照描述        |
| `created_at`      | `TIMESTAMP`   | `DEFAULT CURRENT_TIMESTAMP` | 创建时间                    |
| `updated_at`      | `TIMESTAMP`   | `DEFAULT CURRENT_TIMESTAMP` | 更新时间                    |

### 2.3 关键词表（`document_keywords`）

| 字段名           | 数据类型        | 约束                                                      | 描述           |
| ------------- | ----------- | ------------------------------------------------------- | ------------ |
| `keyword_id`  | `UUID`      | `PRIMARY KEY`                                           | 关键词 ID       |
| `document_id` | `UUID`      | `REFERENCES documents(document_id) ON DELETE CASCADE`   | 所属文档 ID，级联删除 |
| `keyword`     | `TEXT`      | `NOT NULL`                                              | 关键词内容        |
| `created_at`  | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`                             | 创建时间         |
| `updated_at`  | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | 更新时间         |

### 2.4 章节表（`chapters`）

| 字段名           | 数据类型           | 约束                                                                | 描述                     |
| ------------- | -------------- | ----------------------------------------------------------------- | ---------------------- |
| `chapter_id`  | `UUID`         | `PRIMARY KEY`                                                     | 章节容器 ID（用于目录联动 / 层级管理） |
| `document_id` | `UUID`         | `REFERENCES documents(document_id) ON DELETE CASCADE`             | 所属文档 ID，级联删除           |
| `parent_id`   | `UUID`         | `REFERENCES chapters(chapter_id) ON DELETE SET NULL DEFAULT NULL` | 父章节 ID（容器层级）           |
| `title`       | `VARCHAR(200)` | `NOT NULL DEFAULT ''`                                             | 章节标题                   |
| `status`      | `VARCHAR(30)`  | `DEFAULT 'editing'`                                               | 章节状态                   |
| `order_index` | `INTEGER`      | `NOT NULL DEFAULT 0`                                              | 章节容器排序索引               |
| `updated_at`  | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`           | 更新时间                   |

### 2.5 段落表（`paragraphs`）

| 字段名             | 数据类型          | 约束                                                  | 描述                                  |
| --------------- | ------------- | --------------------------------------------------- | ----------------------------------- |
| `paragraph_id`  | `UUID`        | `PRIMARY KEY`                                       | 段落唯一标识                              |
| `chapter_id`    | `UUID`        | `REFERENCES chapters(chapter_id) ON DELETE CASCADE` | 所属章节 ID，级联删除                        |
| `content`       | `TEXT`        | `NOT NULL`                                          | 文本内容                                |
| `para_type`     | `VARCHAR(20)` | `NOT NULL`                                          | 类型：正文、一级标题、二级标题、三级标题、四级标题、五级标题、六级标题 |
| `order_index`   | `INTEGER`     | `NOT NULL`                                          | 段落顺序：在章节内的排列位置                      |
| `ai_eval`       | `TEXT`        | `NULL`                                              | AI 评估结果                             |
| `ai_suggestion` | `TEXT`        | `NULL`                                              | AI 修改建议                             |
| `ai_generate`   | `TEXT`        | `NULL`                                              | AI 帮填生成的内容                          |
| `ischange`      | `INTEGER`     | `NOT NULL DEFAULT 0`                                | 关联摘要是否发生实质变更：0-否，1-是                |

### 2.6 摘要表（`document_summaries`）

| 字段名           | 数据类型           | 约束                                                      | 描述           |
| ------------- | -------------- | ------------------------------------------------------- | ------------ |
| `summary_id`  | `UUID`         | `PRIMARY KEY`                                           | 摘要 ID        |
| `document_id` | `UUID`         | `REFERENCES documents(document_id) ON DELETE CASCADE`   | 所属文档 ID，级联删除 |
| `title`       | `VARCHAR(200)` | `NOT NULL`                                              | 摘要标题         |
| `content`     | `TEXT`         | `NOT NULL`                                              | 摘要内容         |
| `version`     | `INTEGER`      | `NOT NULL DEFAULT 1`                                    | 摘要版本号        |
| `order_index` | `INTEGER`      | `NOT NULL DEFAULT 0`                                    | 排序索引         |
| `created_at`  | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`                             | 创建时间         |
| `updated_at`  | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | 更新时间         |

### 2.7 摘要-段落关联表（`paragraph_summary_links`）

| 字段名                | 数据类型        | 约束                                                            | 描述                    |
| ------------------ | ----------- | ------------------------------------------------------------- | --------------------- |
| `link_id`          | `UUID`      | `PRIMARY KEY`                                                 | 关联 ID                 |
| `paragraph_id`     | `UUID`      | `REFERENCES paragraphs(paragraph_id) ON DELETE CASCADE`       | 段落 ID，级联删除            |
| `summary_id`       | `UUID`      | `REFERENCES document_summaries(summary_id) ON DELETE CASCADE` | 摘要 ID，级联删除            |
| `summary_version`  | `INTEGER`   | `NOT NULL`                                                    | 关联时的摘要版本号             |
| `summary_sections` | `TEXT`      | `NOT NULL`                                                    | 关联时使用的摘要部分（JSON格式字符串） |
| `created_at`       | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`                                   | 创建时间                  |

### 2.8 关键词-摘要关联表（`keyword_summary_links`）

| 字段名          | 数据类型        | 约束                                                            | 描述          |
| ------------ | ----------- | ------------------------------------------------------------- | ----------- |
| `link_id`    | `UUID`      | `PRIMARY KEY`                                                 | 关联 ID       |
| `keyword_id` | `UUID`      | `REFERENCES document_keywords(keyword_id) ON DELETE CASCADE`  | 关键词 ID，级联删除 |
| `summary_id` | `UUID`      | `REFERENCES document_summaries(summary_id) ON DELETE CASCADE` | 摘要 ID，级联删除  |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`                                   | 创建时间        |

### 2.9 关键词-段落关联表（`keyword_paragraph_links`）

| 字段名            | 数据类型        | 约束                                                           | 描述          |
| -------------- | ----------- | ------------------------------------------------------------ | ----------- |
| `link_id`      | `UUID`      | `PRIMARY KEY`                                                | 关联 ID       |
| `keyword_id`   | `UUID`      | `REFERENCES document_keywords(keyword_id) ON DELETE CASCADE` | 关键词 ID，级联删除 |
| `paragraph_id` | `UUID`      | `REFERENCES paragraphs(paragraph_id) ON DELETE CASCADE`      | 段落 ID，级联删除  |
| `created_at`   | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`                                  | 创建时间        |

### 2.7 文档版本表（`document_versions`）

| 字段名             | 数据类型           | 约束                                  | 描述              |
| --------------- | -------------- | ----------------------------------- | --------------- |
| `version_id`    | `UUID`         | `PRIMARY KEY`                       | 版本 ID           |
| `document_id`   | `UUID`         | `REFERENCES documents(document_id)` | 所属文档 ID         |
| `description`   | `VARCHAR(255)` | `NOT NULL`                          | 版本描述            |
| `snapshot_data` | `JSONB`        | `NOT NULL`                          | 版本快照数据（JSON 格式） |
| `created_at`    | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`         | 创建时间            |
| `created_by`    | `UUID`         | `REFERENCES users(user_id)`         | 创建用户 ID         |

### 2.8 操作历史表（`operation_history`）

| 字段名              | 数据类型          | 约束                                  | 描述                           |
| ---------------- | ------------- | ----------------------------------- | ---------------------------- |
| `history_id`     | `UUID`        | `PRIMARY KEY`                       | 历史记录 ID                      |
| `user_id`        | `UUID`        | `REFERENCES users(user_id)`         | 操作用户 ID                      |
| `document_id`    | `UUID`        | `REFERENCES documents(document_id)` | 所属文档 ID                      |
| `chapter_id`     | `UUID`        | `REFERENCES chapters(chapter_id)`   | 操作章节 ID                      |
| `action`         | `VARCHAR(50)` | `NOT NULL`                          | 操作类型（create、update、delete 等） |
| `content_before` | `JSONB`       | `DEFAULT '[]'`                      | 操作前内容（Block Schema格式）        |
| `content_after`  | `JSONB`       | `DEFAULT '[]'`                      | 操作后内容（Block Schema格式）        |
| `created_at`     | `TIMESTAMP`   | `DEFAULT CURRENT_TIMESTAMP`         | 操作时间                         |

### 2.9 聊天记录表（`chat_records`）

| 字段名               | 数据类型          | 约束                                  | 描述                       |
| ----------------- | ------------- | ----------------------------------- | ------------------------ |
| `chat_id`         | `UUID`        | `PRIMARY KEY`                       | 聊天记录 ID                  |
| `user_id`         | `UUID`        | `REFERENCES users(user_id)`         | 用户 ID                    |
| `document_id`     | `UUID`        | `REFERENCES documents(document_id)` | 所属文档 ID                  |
| `chapter_id`      | `UUID`        | `REFERENCES chapters(chapter_id)`   | 关联章节 ID                  |
| `chapter_content` | `JSONB`       | `NULL`                              | 聊天时的章节内容（Block Schema格式） |
| `message`         | `TEXT`        | `NOT NULL`                          | 用户消息                     |
| `response`        | `TEXT`        | `NOT NULL`                          | AI 响应                    |
| `mode`            | `VARCHAR(20)` | `DEFAULT 'chat'`                    | 聊天模式（chat 或 revision）    |
| `created_at`      | `TIMESTAMP`   | `DEFAULT CURRENT_TIMESTAMP`         | 聊天时间                     |

## 3. 数据库关系图

```
+-------------+       +-------------+       +-------------+       +-------------+
|   users     |       |  documents  |       |  chapters   |       | paragraphs  |
+-------------+       +-------------+       +-------------+       +-------------+
| user_id (PK)|<------| user_id (FK)|<------| document_id |<------| chapter_id  |
| email       |       | title       |       | parent_id   |       | content     |
| password_hash|      | keywords    |       | title       |       | para_type   |
| name        |       | status      |       | status      |       | order_index |
| role        |       | created_at  |       | order_index |       | ai_eval     |
| created_at  |       | updated_at  |       | updated_at  |       | ai_suggestion |
| updated_at  |       +-------------+       +-------------+       +-------------+
+-------------+                     |                                         ^
                                   v                                         |
                           +---------------------+       +-------------------------+
                           | document_summaries  |       | paragraph_summary_links |
                           +---------------------+       +-------------------------+
                           | summary_id (PK)     |       | link_id (PK)            |
                           | document_id (FK)    |<------| summary_id (FK)         |
                           | title               |       | paragraph_id (FK)        |
                           | content             |       | summary_version         |
                           | version             |       | summary_sections        |
                           | created_at          |       | created_at              |
                           | updated_at          |       +-------------------------+
                           +---------------------+                           |
        ^                                                                   |
        |                                                                   |
+-------------+       +-------------------+                                  |
| chat_records|       | document_versions|                                  |
+-------------+       +-------------------+                                  |
| chat_id (PK)|       | version_id (PK)  |                                  |
| user_id (FK)|-------| document_id (FK) |                                  |
| document_id |       | description      |                                  |
| chapter_id  |       | snapshot_data    |                                  |
| message     |       | created_at       |                                  |
| response    |       | created_by (FK)  |                                  |
| mode        |       +-------------------+                                  |
| created_at  |                                                             |
+-------------+                                                             |
                                                                           |
+-------------------+                                                      |
| operation_history |                                                      |
+-------------------+                                                      |
| history_id (PK)   |-----------------------------------------------------+
| user_id (FK)      |
| document_id (FK)  |
| chapter_id (FK)   |
| action            |
| content_before    |
| content_after     |
| created_at        |
+-------------------+
```

## 4. 索引设计

### 4.1 主键索引

所有表的主键字段都自动创建了索引。

### 4.2 外键索引

| 表名                        | 索引字段           | 类型     | 描述         |
| ------------------------- | -------------- | ------ | ---------- |
| `documents`               | `user_id`      | B-tree | 加速用户文档查询   |
| `chapters`                | `document_id`  | B-tree | 加速文档章节查询   |
| `chapters`                | `parent_id`    | B-tree | 加速章节层级查询   |
| `paragraphs`              | `chapter_id`   | B-tree | 加速章节段落查询   |
| `document_summaries`      | `document_id`  | B-tree | 加速文档摘要查询   |
| `paragraph_summary_links` | `paragraph_id` | B-tree | 加速段落关联查询   |
| `paragraph_summary_links` | `summary_id`   | B-tree | 加速摘要关联查询   |
| `document_versions`       | `document_id`  | B-tree | 加速文档版本查询   |
| `operation_history`       | `document_id`  | B-tree | 加速文档操作历史查询 |
| `operation_history`       | `chapter_id`   | B-tree | 加速章节操作历史查询 |
| `chat_records`            | `document_id`  | B-tree | 加速文档聊天记录查询 |
| `chat_records`            | `chapter_id`   | B-tree | 加速章节聊天记录查询 |

### 4.3 其他索引

| 表名           | 索引字段          | 类型     | 描述         |
| ------------ | ------------- | ------ | ---------- |
| `users`      | `email`       | B-tree | 加速用户登录查询   |
| `documents`  | `title`       | GIN    | 加速文档标题全文搜索 |
| `documents`  | `keywords`    | GIN    | 加速关键词搜索    |
| `chapters`   | `order_index` | B-tree | 加速章节排序     |
| `paragraphs` | `order_index` | B-tree | 加速段落排序     |

## 5. 约束与触发器

### 5.1 约束

| 表名           | 约束                 | 描述          |
| ------------ | ------------------ | ----------- |
| `users`      | `email` 唯一约束       | 确保用户邮箱不重复   |
| `documents`  | `title` 非空约束       | 确保文档标题不为空   |
| `chapters`   | `title` 非空约束       | 确保章节标题不为空   |
| `chapters`   | `order_index` 非空约束 | 确保章节排序索引不为空 |
| `paragraphs` | `content` 非空约束     | 确保段落内容不为空   |
| `paragraphs` | `para_type` 非空约束   | 确保段落类型不为空   |
| `paragraphs` | `order_index` 非空约束 | 确保段落排序索引不为空 |

### 5.2 触发器

| 触发器名                          | 关联表         | 触发事件     | 功能描述                 |
| ----------------------------- | ----------- | -------- | -------------------- |
| `update_documents_updated_at` | `documents` | `UPDATE` | 自动更新 `updated_at` 字段 |
| `update_chapters_updated_at`  | `chapters`  | `UPDATE` | 自动更新 `updated_at` 字段 |
| `update_users_updated_at`     | `users`     | `UPDATE` | 自动更新 `updated_at` 字段 |

## 6. 数据库初始化

### 6.1 创建表结构

```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    title VARCHAR(80) NOT NULL,
    keywords TEXT[] NOT NULL,
    abstract TEXT,
    content JSONB DEFAULT '[]',
    purpose VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    snapshot_cursor INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建章节表
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES chapters(chapter_id) ON DELETE SET NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(30) DEFAULT 'editing',
    order_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建段落表
CREATE TABLE IF NOT EXISTS paragraphs (
    paragraph_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    para_type VARCHAR(20) NOT NULL,
    order_index INTEGER NOT NULL,
    ai_eval TEXT,
    ai_suggestion TEXT,
    ai_generate TEXT,
    ischange INTEGER NOT NULL DEFAULT 0
);

-- 创建摘要表
CREATE TABLE IF NOT EXISTS document_summaries (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建摘要-段落关联表
CREATE TABLE IF NOT EXISTS paragraph_summary_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES paragraphs(paragraph_id) ON DELETE CASCADE,
    summary_id UUID REFERENCES document_summaries(summary_id) ON DELETE CASCADE,
    summary_version INTEGER NOT NULL,
    summary_sections TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建文档版本表
CREATE TABLE IF NOT EXISTS document_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id),
    description VARCHAR(255) NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id)
);

-- 创建操作历史表
CREATE TABLE IF NOT EXISTS operation_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id),
    chapter_id UUID REFERENCES chapters(chapter_id),
    action VARCHAR(50) NOT NULL,
    content_before JSONB DEFAULT '[]',
    content_after JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建聊天记录表
CREATE TABLE IF NOT EXISTS chat_records (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id),
    chapter_id UUID REFERENCES chapters(chapter_id),
    chapter_content JSONB,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    mode VARCHAR(20) DEFAULT 'chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id ON chapters(parent_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_chapter_id ON paragraphs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_order_index ON paragraphs(order_index);

-- 创建摘要表索引
CREATE INDEX IF NOT EXISTS idx_document_summaries_document_id ON document_summaries(document_id);

-- 创建摘要-段落关联表索引
CREATE INDEX IF NOT EXISTS idx_paragraph_summary_links_paragraph_id ON paragraph_summary_links(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_summary_links_summary_id ON paragraph_summary_links(summary_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_operation_history_document_id ON operation_history(document_id);
CREATE INDEX IF NOT EXISTS idx_operation_history_chapter_id ON operation_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_document_id ON chat_records(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_chapter_id ON chat_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_documents_keywords ON documents USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_chapters_order_index ON chapters(order_index);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
BEFORE UPDATE ON chapters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## 7. 数据迁移与维护

### 7.1 数据迁移

系统使用 Alembic 进行数据库迁移管理，确保数据库结构的变更能够安全、有序地进行。

### 7.2 数据备份

建议定期对数据库进行备份，包括：

* 每日增量备份

* 每周全量备份

* 每月归档备份

### 7.3 数据清理

| 表名                  | 清理策略      | 描述              |
| ------------------- | --------- | --------------- |
| `operation_history` | 保留 3 个月数据 | 超过 3 个月的操作历史可清理 |
| `chat_records`      | 保留 6 个月数据 | 超过 6 个月的聊天记录可清理 |

## 8. 性能优化建议

1. **使用连接池**：配置合适的数据库连接池，减少连接开销。
2. **批量操作**：对于大量数据的插入和更新，使用批量操作减少数据库交互次数。
3. **查询优化**：使用索引、避免全表扫描、优化复杂查询。
4. **缓存策略**：对频繁访问的数据使用缓存，减少数据库查询。
5. **分区表**：对于大表（如 `operation_history`），考虑使用分区表提高查询性能。
6. **定期维护**：定期运行 `VACUUM` 和 `ANALYZE` 命令，优化数据库性能。

