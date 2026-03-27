# Fix Template Rollback Spec

## Why
目前在 `TemplateService.rollback_template` 执行回退操作时，仅仅将官方系统模板的 `Template` 主表数据（如 `content` 字段）覆盖到用户的私有模板上，但**遗漏了对所有关联子表（CoreInfoTemplate, SummaryTemplate, StructureTemplate）的回退处理**。这会导致用户如果在微调时修改了子表结构，点击回退后，大纲或摘要等结构化数据无法恢复到官方初始状态，造成数据不一致。

## What Changes
- 修改 `TemplateService.rollback_template`，在回退主表 `content` 数据之前或之后，增加对子表的清理和重新深拷贝逻辑。
- 引入在 `DocumentService.create_document` 中已经验证过的“排序+哈希表映射”算法，用于在回退时重新复制 `StructureTemplate` 树形结构。
- 清理当前模板下的所有旧子表数据（`CoreInfoTemplate`, `SummaryTemplate`, `StructureTemplate`）。
- 从官方模板（`official_template`）重新拷贝这三张子表的数据到当前用户模板（`source_template`）下。

## Impact
- Affected code: `backend/services/template_service.py` 及其依赖的 Mapper。
- Affected specs: 完善了模板的回退机制，保证了模板所有层级配置的彻底重置。

## ADDED Requirements
### Requirement: 完整的模板回退机制
当用户触发回退官方模板操作时，系统必须将该模板下所有的子表记录清空，并从同组的官方系统模板中重新深拷贝一份完整的子表数据。

#### Scenario: Success case
- **WHEN** 用户点击回退官方模板并调用 API
- **THEN** 用户的私有模板（主表及所有子表）的内容与官方模板完全一致，且树形结构的外键引用关系保持正确。
