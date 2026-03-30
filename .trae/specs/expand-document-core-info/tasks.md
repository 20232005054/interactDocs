# Tasks

* [x] Task 1: 更新数据库模型

  * [x] SubTask 1.1: 在 `backend/db/models.py` 的 `DocumentCoreInfo` 类中添加 `field_type`, `options`, `is_required` 字段。

* [x] Task 2: 更新 Pydantic Schemas

  * [x] SubTask 2.1: 在 `backend/schemas/schemas.py` 的 `CoreInfoBase` 中添加 `field_type`, `options`, `is_required` 字段。

* [x] Task 3: 更新服务逻辑

  * [x] SubTask 3.1: 更新 `backend/services/document_service.py` 中的 `apply_core_info_template` 方法，使其在实例化 `DocumentCoreInfo` 时拷贝 `field_type`, `options`, `is_required` 字段。

  * [x] SubTask 3.2: 更新 `backend/services/core_info_service.py` 中的 `create_core_info` 方法，使其在创建记录时保存这三个新字段。

* [x] Task 4: 数据库迁移

  * [x] SubTask 4.1: 执行 Alembic 迁移或通过 SQL 脚本更新 `document_core_info` 表的表结构，提供数据迁移语句（删除旧表，创建新表）

  * [x] 更新init.sql

