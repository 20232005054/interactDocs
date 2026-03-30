# Expand DocumentCoreInfo Spec

## Why
目前，`CoreInfoTemplate` 表包含了高级表单配置（`field_type`、`options`、`is_required`），但这些配置并没有同步到实例化的 `DocumentCoreInfo` 表中。导致前端在用户编辑文档核心信息时，失去了渲染富文本动态表单（如：下拉框、日期选择器等）的能力。扩充 `DocumentCoreInfo` 表来包含这些字段将解决这个问题。

## What Changes
- 在 `DocumentCoreInfo` 模型中新增 `field_type` (String, default="text") 字段。
- 在 `DocumentCoreInfo` 模型中新增 `options` (JSONB, nullable=True) 字段。
- 在 `DocumentCoreInfo` 模型中新增 `is_required` (Boolean, default=True) 字段。
- 更新 `schemas/schemas.py` 中相关的 Pydantic Schemas (`CoreInfoBase`, `CoreInfo` 等)。
- 更新 `document_service.py` 中的 `apply_core_info_template` 方法，在实例化时拷贝这些新字段。
- 更新 `core_info_service.py` 中的 `create_core_info` 等方法，支持新字段的保存。

## Impact
- Affected specs: 核心信息动态表单渲染能力
- Affected code: 
  - `backend/db/models.py`
  - `backend/schemas/schemas.py`
  - `backend/services/document_service.py`
  - `backend/services/core_info_service.py`

## ADDED Requirements
### Requirement: 保留表单配置
The system SHALL 在将模板应用到文档时，将 `field_type`、`options` 和 `is_required` 从 `CoreInfoTemplate` 拷贝到 `DocumentCoreInfo` 中。

#### Scenario: Success case
- **WHEN** 用户通过模板创建文档
- **THEN** 生成的 `DocumentCoreInfo` 记录将拥有与源模板完全一致的 `field_type`、`options` 和 `is_required` 值。