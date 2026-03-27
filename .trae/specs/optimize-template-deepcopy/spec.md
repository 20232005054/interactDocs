# Optimize Template Deep Copy Spec

## Why
目前在 `DocumentService.create_document` 创建文档时，仅对模板主表 (`Template`) 进行了浅拷贝，导致子表 (`CoreInfoTemplate`, `SummaryTemplate`, `StructureTemplate`) 数据丢失，后续应用结构生成大纲时会出现空数据 Bug。
为了支持用户在创建文档后自由微调模板（且不影响官方模板），并修复当前数据丢失的 Bug，我们需要实现完整的模板体系深拷贝。

## What Changes
- 修改 `DocumentService.create_document`，在创建文档并生成新模板 ID 后，追加对关联子表的深拷贝逻辑。
- 采用 **"层级排序 + 哈希表映射"** 算法，安全高效地深拷贝 `StructureTemplate` 表，解决树形结构自引用 (`parent_id`) 的映射问题。
- 深拷贝 `CoreInfoTemplate` 和 `SummaryTemplate` 记录并关联至新模板。

## Impact
- Affected code: `backend/services/document_service.py` 及其依赖。
- Affected specs: 优化了文档创建流程，解决了应用模板时大纲为空的潜在 Bug。

## ADDED Requirements
### Requirement: 完整的模板深拷贝机制
在创建文档时，系统必须将所选模板的所有子表数据完整复制到新模板 ID 下。

#### Scenario: Success case
- **WHEN** 用户调用创建文档 API 传入 `template_id`
- **THEN** 数据库不仅创建新的 `Template` 主记录，还会同步复制所有核心信息字段、摘要块，并正确复制保持原有层级关系的结构树。
