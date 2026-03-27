# Fix Ambiguous Foreign Keys Spec

## Why
在 `Template` 模型中添加了 `document_id` 冗余字段后，`Document` 和 `Template` 表之间出现了双向外键引用（`Document.template_id` 指向 `Template`，且 `Template.document_id` 指向 `Document`）。
这导致 SQLAlchemy 在解析 `Document` 模型中的 `template = relationship("Template", backref="documents")` 时，无法自动推断应该使用哪一条外键路径，从而抛出 `AmbiguousForeignKeysError` 错误。

## What Changes
- 修改 `backend/db/models.py` 中 `Document` 模型的 `template` 关系定义。
- 在 `relationship` 函数中显式添加 `foreign_keys=[template_id]` 参数，消除外键推断歧义。

## Impact
- Affected code: `backend/db/models.py`。
- Affected specs: 修复了应用启动和数据库查询时的致命错误。

## ADDED Requirements
### Requirement: 明确 SQLAlchemy 的外键关系
当两个表之间存在多条外键路径时，必须在定义 `relationship` 时显式指定 `foreign_keys`。

#### Scenario: Success case
- **WHEN** 后端服务启动或查询 Document 信息时
- **THEN** 不再抛出 `AmbiguousForeignKeysError`，服务正常运行。