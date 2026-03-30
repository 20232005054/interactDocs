# 同步创建模板依赖边关联 Spec

## Why
目前系统在应用摘要模板和结构模板时，会基于 `sources` 中的定义去寻找依赖项（如核心信息、其他摘要、章节）来生成内容。但是，这个过程并没有将这种依赖关系持久化到 `DependencyEdge` 边关联表中。这就导致了如果后续全局变量或上游摘要发生修改，系统无法通过溯源边（溯源图谱）自动感知并提示哪些下游内容需要更新。为了完善系统的知识图谱和变更溯源能力，需要在应用模板生成内容时，同步根据 `sources` 建立底层的依赖边。

## What Changes
- 在 `document_service.py` 中引入 `DependencyService`。
- 修改 `apply_summary_template`：
  - 在应用模板循环之前，预加载当前文档的 `DocumentCoreInfo` 记录，构建 `{field_key: core_info_id}` 映射。
  - 在生成 `DocumentSummary` 并提交后（或之前获取其分配的 UUID），解析该模板的 `sources`。
  - 根据 `source` 类型（`keyinfo`、`summary`、`chapter`）和 `match_key`，从预加载的映射或上下文中查找对应的 `target_id`。
  - 针对每个有效的 source 记录，调用 `DependencyService.create_dependency_edge` 创建 `summary -> target` 的依赖边。
- 修改 `apply_structure_template`：
  - 在应用模板循环之前，预加载当前文档的 `DocumentCoreInfo` 记录，构建 `{field_key: core_info_id}` 映射。
  - 同样，预加载当前文档的 `DocumentSummary` 记录，构建 `{field_key: summary_id}` 映射。
  - 在创建 `Chapter` 以及（如果 mode 1）对应的 `Paragraph` 后，如果存在 `sources` 且生成了 `Paragraph`，则解析 `sources`。
  - 根据映射查找到 `target_id`，调用 `DependencyService.create_dependency_edge` 创建 `paragraph -> target` 的依赖边。
- **注意**：为了避免 N+1 查询，所有的 target 查找都必须基于在应用模板函数开始时预加载的内存字典进行。

## Impact
- Affected specs: 模板应用流程（摘要与结构模板的实例化）。
- Affected code:
  - `backend/services/document_service.py`

## ADDED Requirements
### Requirement: 摘要模板应用同步建边
The system SHALL 在执行应用摘要模板生成文档摘要记录时，根据该模板的 `sources` 字段，为生成的摘要记录创建对应的溯源依赖边。

#### Scenario: Success case
- **WHEN** 用户执行应用摘要模板，且某个摘要模板的 `sources` 引用了 `keyinfo` (match_key="trial_name")。
- **THEN** 系统在生成该 `DocumentSummary` 的同时，会在 `DependencyEdge` 表中插入一条记录，其中 `source_type='summary'`, `source_id` 为新摘要的 UUID, `target_type='document_entity'`, `target_id` 为当前文档中 `field_key="trial_name"` 的 `DocumentCoreInfo` 的 UUID。

### Requirement: 结构模板应用同步建边
The system SHALL 在执行应用结构模板生成章节和段落时，根据该结构模板的 `sources` 字段，为生成的内容承载实体（段落 `Paragraph`）创建对应的溯源依赖边。

#### Scenario: Success case
- **WHEN** 用户执行应用结构模板（包含内容生成的段落），且该结构模板的 `sources` 引用了 `summary` (match_key="summary_background")。
- **THEN** 系统在生成该 `Paragraph` 的同时，会在 `DependencyEdge` 表中插入一条记录，其中 `source_type='paragraph'`, `source_id` 为新段落的 UUID, `target_type='summary'`, `target_id` 为当前文档中对应摘要的 UUID。
