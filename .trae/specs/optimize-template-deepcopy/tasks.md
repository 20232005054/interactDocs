# Tasks
- [x] Task 1: 准备深拷贝所需的 Mapper 方法
  - [x] SubTask 1.1: 检查或在 `SummaryTemplateMapper` 和 `StructureTemplateMapper` 中补充批量创建 (`batch_create`) 方法
- [x] Task 2: 在 `DocumentService.create_document` 中实现深拷贝逻辑
  - [x] SubTask 2.1: 读取原模板的 `CoreInfoTemplate` 并批量复制关联新 ID
  - [x] SubTask 2.2: 读取原模板的 `SummaryTemplate` 并批量复制关联新 ID
  - [x] SubTask 2.3: 读取原模板的 `StructureTemplate`，使用排序+哈希表映射算法复制树形结构，确保 `parent_id` 引用正确
- [x] Task 3: 测试验证
  - [x] SubTask 3.1: 编写或运行相关测试脚本，确保创建文档后，原有的树形结构被无损拷贝到新模板下。
