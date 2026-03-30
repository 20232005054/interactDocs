# Tasks

- [x] Task 1: 实现字典预加载逻辑以解决 N+1 查询问题
  - [x] SubTask 1.1: 在 `backend/services/document_service.py` 中编写辅助函数或在现有方法中添加逻辑，用于根据 `document_id` 一次性查出所有的 `DocumentCoreInfo`，并构建 `{field_key: core_info_id}` 映射。
  - [x] SubTask 1.2: 同样地，构建获取当前文档所有 `DocumentSummary` 并映射为 `{field_key: summary_id}` 的逻辑（注意考虑本轮新生成的摘要如何加入此映射）。

- [x] Task 2: 改造 `apply_summary_template` 实现同步建边
  - [x] SubTask 2.1: 引入 `DependencyService`。
  - [x] SubTask 2.2: 在 `DocumentSummary` 对象准备好并获取到 ID 后（可能需要先 `db.flush()`），遍历 `tmpl.sources`。
  - [x] SubTask 2.3: 根据 `source` 和 `match_key` 从预加载字典中获取 `target_id`，并调用 `create_dependency_edge` 创建 `summary -> target` 的边。
  - [x] SubTask 2.4: 更新测试用例，验证应用摘要模板时依赖边是否被正确创建。

- [x] Task 3: 改造 `apply_structure_template` 实现同步建边
  - [x] SubTask 3.1: 在应用结构模板的循环中，如果生成了正文段落（`Paragraph`），并且模板中存在 `sources`。
  - [x] SubTask 3.2: 遍历 `tmpl.sources`，利用预加载字典获取 `target_id`。对于 `source="chapter"`，利用已有的 `template_id_map` 映射到真实的 `chapter_id`。
  - [x] SubTask 3.3: 调用 `create_dependency_edge` 创建 `paragraph -> target` 的边。
  - [x] SubTask 3.4: 更新测试用例，验证应用结构模板生成段落时，依赖边是否被正确创建。

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
