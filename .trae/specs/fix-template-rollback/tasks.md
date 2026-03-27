# Tasks
- [x] Task 1: 引入依赖
  - [x] SubTask 1.1: 在 `template_service.py` 中引入所需的 Mapper (`CoreInfoTemplateMapper`, `SummaryTemplateMapper`, `StructureTemplateMapper`)。
- [x] Task 2: 补充清理与深拷贝逻辑到 `rollback_template`
  - [x] SubTask 2.1: 清空当前模板 (`source_template.template_id`) 下的旧 `CoreInfoTemplate`, `SummaryTemplate`, `StructureTemplate` 数据。
  - [x] SubTask 2.2: 从 `official_template` 读取并批量复制 `CoreInfoTemplate` 关联至 `source_template`。
  - [x] SubTask 2.3: 从 `official_template` 读取并批量复制 `SummaryTemplate` 关联至 `source_template`。
  - [x] SubTask 2.4: 从 `official_template` 读取 `StructureTemplate`，使用按层级排序+哈希表映射算法批量复制，关联至 `source_template`。
- [x] Task 3: 代码审查与验证
  - [x] SubTask 3.1: 确认事务完整性（确保回退过程中的清空和插入都在同一个 session 中安全执行）。
