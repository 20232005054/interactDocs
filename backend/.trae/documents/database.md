# 数据库文档

## 1. 数据库结构

### 1.1 文档表 (Document)
- **表名**: `document`
- **字段**:
  - `document_id` (UUID): 主键
  - `title` (VARCHAR): 文档标题
  - `purpose` (VARCHAR): 使用目的
  - `template_id` (UUID): 模板ID，外键
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.2 章节表 (Chapter)
- **表名**: `chapter`
- **字段**:
  - `chapter_id` (UUID): 主键
  - `document_id` (UUID): 文档ID，外键
  - `title` (VARCHAR): 章节标题
  - `order_index` (INTEGER): 排序索引
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.3 段落表 (Paragraph)
- **表名**: `paragraph`
- **字段**:
  - `paragraph_id` (UUID): 主键
  - `chapter_id` (UUID): 章节ID，外键
  - `content` (TEXT): 段落内容
  - `ai_generate` (TEXT): AI生成内容
  - `para_type` (VARCHAR): 段落类型 (paragraph/heading-1/heading-2/heading-3)
  - `order_index` (INTEGER): 排序索引
  - `is_change` (BOOLEAN): 是否变更
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.4 摘要表 (Summary)
- **表名**: `summary`
- **字段**:
  - `summary_id` (UUID): 主键
  - `document_id` (UUID): 文档ID，外键
  - `title` (VARCHAR): 摘要标题
  - `content` (TEXT): 摘要内容
  - `ai_generate` (TEXT): AI生成内容
  - `order_index` (INTEGER): 排序索引
  - `is_change` (BOOLEAN): 是否变更
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.5 关键词表 (Keyword)
- **表名**: `keyword`
- **字段**:
  - `keyword_id` (UUID): 主键
  - `document_id` (UUID): 文档ID，外键
  - `keyword` (VARCHAR): 关键词
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.6 模板表 (Template)
- **表名**: `template`
- **字段**:
  - `template_id` (UUID): 主键
  - `user_id` (UUID): 用户ID
  - `group_id` (UUID): 模板组ID
  - `purpose` (VARCHAR): 使用目的
  - `name` (VARCHAR): 模板名称
  - `content` (JSONB): 模板内容
  - `version` (INTEGER): 版本号
  - `is_system` (BOOLEAN): 是否系统模板
  - `is_active` (BOOLEAN): 是否激活
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

### 1.7 操作历史表 (OperationHistory)
- **表名**: `operation_history`
- **字段**:
  - `history_id` (UUID): 主键
  - `user_id` (UUID): 用户ID
  - `action` (VARCHAR): 操作类型
  - `target_type` (VARCHAR): 目标类型
  - `target_id` (UUID): 目标ID
  - `details` (JSONB): 操作详情
  - `created_at` (TIMESTAMP): 创建时间

### 1.8 依赖边表 (DependencyEdge)
- **表名**: `dependency_edge`
- **字段**:
  - `edge_id` (UUID): 主键
  - `source_type` (VARCHAR): 源类型
  - `source_id` (UUID): 源ID
  - `target_type` (VARCHAR): 目标类型
  - `target_id` (UUID): 目标ID
  - `dependency_type` (VARCHAR): 依赖类型
  - `created_at` (TIMESTAMP): 创建时间
  - `updated_at` (TIMESTAMP): 更新时间

## 2. 关联关系

### 2.1 一对多关系
- **Document → Chapter**: 一个文档包含多个章节
- **Chapter → Paragraph**: 一个章节包含多个段落
- **Document → Summary**: 一个文档包含多个摘要
- **Document → Keyword**: 一个文档包含多个关键词

### 2.2 多对多关系
- **Paragraph ↔ Summary**: 段落与摘要的关联（通过依赖边表）
- **Paragraph ↔ Keyword**: 段落与关键词的关联（通过依赖边表）

## 3. 数据流转

### 3.1 文档创建流程
1. 用户创建文档，指定标题、使用目的和模板
2. 系统根据模板自动生成章节结构
3. 用户可以添加/编辑段落内容

### 3.2 AI辅助流程
1. 用户触发AI帮填功能
2. 系统收集相关信息（关键词、摘要）
3. 调用AI模型生成内容
4. 将生成内容保存到对应字段
5. 建立内容与关键词、摘要的关联

### 3.3 变更检测流程
1. 用户修改段落或摘要内容
2. 系统检测是否为实质性变更
3. 如为实质性变更，更新 `is_change` 标记
4. 触发相关依赖的更新

## 4. 索引设计

### 4.1 主键索引
- 所有表的主键字段都有默认的主键索引

### 4.2 外键索引
- `chapter.document_id`
- `paragraph.chapter_id`
- `summary.document_id`
- `keyword.document_id`
- `template.group_id`

### 4.3 普通索引
- `document.purpose`
- `chapter.order_index`
- `paragraph.order_index`
- `summary.order_index`
- `template.purpose`
- `template.is_system`
- `template.is_active`
- `dependency_edge.source_type`
- `dependency_edge.target_type`

## 5. 数据安全

### 5.1 访问控制
- 系统模板只有管理员可以修改
- 用户只能修改自己创建的模板
- 文档访问权限基于用户身份

### 5.2 数据备份
- 定期备份数据库
- 模板版本控制，支持回滚

### 5.3 数据验证
- 所有输入数据都经过验证
- 外键约束确保数据完整性
- 事务处理确保数据一致性
