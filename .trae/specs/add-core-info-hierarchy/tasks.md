# Tasks
- [x] Task 1: Update Database Models: 在数据库模型中实现自关联
  - [x] SubTask 1.1: 在 `CoreInfoTemplate` 中添加 `parent_id` 和 `children`
  - [x] SubTask 1.2: 在 `DocumentCoreInfo` 中添加 `parent_id` 和 `children`
- [x] Task 2: Create Database Migration: 处理数据库结构变更
  - [x] SubTask 2.1: 确认现有数据情况，如果使用 Alembic 则生成添加 `parent_id` 的迁移脚本并应用
- [x] Task 3: Update Schemas: 更新 Pydantic 模型
  - [x] SubTask 3.1: 更新 `CoreInfoTemplate` 相关的 schemas，增加 `children` 嵌套支持
  - [x] SubTask 3.2: 更新 `DocumentCoreInfo` 相关的 schemas，增加 `children` 嵌套支持
- [x] Task 4: Update CRUD and API Logic: 调整业务逻辑以支持树形结构
  - [x] SubTask 4.1: 修改查询逻辑，将扁平数据组装为树形结构返回
  - [x] SubTask 4.2: 修改创建/更新逻辑，支持 `parent_id` 的写入与层级关系的校验

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]