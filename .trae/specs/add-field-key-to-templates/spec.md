# Add field_key to Templates Spec

## Why
目前系统中，`sources` 的 `match_key` 在引用核心信息（`keyinfo`）时使用英文字段 `field_key`，但在引用摘要（`summary`）和章节（`chapter`）时使用的是无语义的数据库主键 `UUID`。这种不一致会导致在基于模板创建新文档（深拷贝）时，因为 `UUID` 发生了改变而使得引用关系断裂，极大地增加了后端的维护成本，且不利于后续模板的导入和导出。为了实现引用的完美解耦，我们需要给摘要模板和结构模板都增加一个独立的业务键 `field_key`。

## What Changes
- 在 `SummaryTemplate` 数据库模型中新增 `field_key` (String(50), nullable=False) 字段。
- 在 `StructureTemplate` 数据库模型中新增 `field_key` (String(50), nullable=False) 字段。
- 在相关的 Pydantic Schema（如 `SummaryTemplateCreate`, `SummaryTemplateUpdate`, `StructureTemplateCreate`, `StructureTemplateUpdate` 等）中增加 `field_key` 字段。
- 修改 `backend/sql/database.sql`，在 `summary_templates` 和 `structure_templates` 建表语句中增加 `field_key` 字段。
- 提供对应的 SQL 迁移脚本以更新现有数据库。
- 在服务层 `document_service.py` 里的 `apply_summary_template` 和 `apply_structure_template` 深拷贝逻辑中，确保将模板的 `field_key` 完整拷贝到文档的摘要和章节实例中（需要确保实例表 `DocumentSummary` 和 `Chapter` 也支持相应的标识，但如果实例本身仅用于展示或目前阶段不需要作为被引用方继续拷贝，则可能只需在实例中处理关联。根据当前业务，文档生成的实例主要是消耗方，模板间引用是配置阶段的事，所以重点在于配置表）。
- **BREAKING**: 注意，这可能需要同步更新现有的测试 SQL 脚本 `backend/sql/insert_template_test_data.sql`，将所有涉及 `UUID` 匹配的 `sources` 更改为使用 `field_key` 匹配。

## Impact
- Affected specs: 模板节点间的相互引用机制（`sources` 中的 `match_key` 解析）。
- Affected code: 
  - `backend/db/models.py`
  - `backend/schemas/schemas.py`
  - `backend/sql/database.sql`
  - `backend/sql/insert_template_test_data.sql`

## ADDED Requirements
### Requirement: 统一使用业务标识键
The system SHALL 在所有的模板引用配置（`sources`）中统一使用 `field_key` 来作为节点的唯一引用标识，替代底层数据库的 `UUID`。

#### Scenario: Success case
- **WHEN** 用户在配置章节结构时引用了某个摘要。
- **THEN** 该章节的 `sources` 中的 `match_key` 将存储被引用摘要的 `field_key`，而不是其数据库 `UUID`。