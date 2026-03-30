# Tasks
- [x] Task 1: 更新数据库模型
  - [x] SubTask 1.1: 在 `backend/db/models.py` 的 `SummaryTemplate` 类中添加 `field_key = Column(String(50), nullable=False)` 字段。
  - [x] SubTask 1.2: 在 `backend/db/models.py` 的 `StructureTemplate` 类中添加 `field_key = Column(String(50), nullable=False)` 字段。

- [x] Task 2: 更新 Pydantic Schemas
  - [x] SubTask 2.1: 在 `backend/schemas/schemas.py` 的 `SummaryTemplateCreate` 和 `SummaryTemplateUpdate` 中添加 `field_key` 字段。
  - [x] SubTask 2.2: 在 `backend/schemas/schemas.py` 的 `StructureTemplateCreate` 和 `StructureTemplateUpdate` 中添加 `field_key` 字段。

- [x] Task 3: 更新服务逻辑与拷贝逻辑
  - [x] SubTask 3.1: 在 `backend/services/document_service.py` 中，更新 `create_document` 时的模板深拷贝逻辑（`深拷贝 SummaryTemplate` 和 `深拷贝 StructureTemplate` 的部分），确保新生成的模板记录能够正确携带或继承 `field_key`。
  
- [x] Task 4: 更新数据库初始化脚本和迁移脚本
  - [x] SubTask 4.1: 修改 `backend/sql/database.sql`，在 `summary_templates` 和 `structure_templates` 的建表语句中增加 `field_key VARCHAR(50) NOT NULL`。
  - [x] SubTask 4.2: 创建一个 SQL 迁移脚本，用于更新现有数据库表（添加 `field_key` 并为旧数据生成默认值）。

- [x] Task 5: 修正测试数据与引用
  - [x] SubTask 5.1: 彻底排查并更新 `backend/sql/insert_template_test_data.sql`。给所有的摘要和章节插入语句增加一个手写的 `field_key`（例如 `'sum_xxx'`，`'chp_xxx'`），并将所有的 `sources` JSON 中的 UUID 替换为这些对应的 `field_key`。