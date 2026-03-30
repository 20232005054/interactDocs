* [x] `apply_summary_template` 执行后，数据库 `dependency_edges` 表中成功生成了 `source_type='summary'` 的关联记录。

* [x] `apply_structure_template` 执行后，数据库 `dependency_edges` 表中成功生成了 `source_type='paragraph'` 的关联记录。

* [x] 对于 `source="keyinfo"`，边表中的 `target_type` 被正确映射为 `'document_entity'`，且 `target_id` 正确。

* [x] 对于 `source="summary"`，边表中的 `target_type` 被正确映射为 `'summary'`，且 `target_id` 正确。

* [x] 对于 `source="chapter"`，边表中的 `target_type` 被正确映射为 `'chapter'`，且 `target_id` 正确。

* [x] 所有通过 `match_key` 到 `target_id` 的查找都在内存字典中完成，没有产生 N+1 查询性能问题。

* [x] 测试用例通过，验证了边关联的正确创建。

