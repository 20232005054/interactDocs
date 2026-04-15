-- 迁移：is_system (Boolean) → template_type (Integer)
-- template_type: 0=文档私有副本, 1=系统模板, 2=用户可复用私有模板, 3=用户公开分享(未实现)
--
-- 执行前请备份 templates 表！

BEGIN;

-- 1. 新增 template_type 列，默认 0
ALTER TABLE templates ADD COLUMN template_type INTEGER NOT NULL DEFAULT 0;

-- 2. 存量数据转换
--    is_system=TRUE → 系统模板 (1)
UPDATE templates SET template_type = 1 WHERE is_system = TRUE;

--    is_system=FALSE + document_id IS NOT NULL → 文档私有副本 (0)
UPDATE templates SET template_type = 0 WHERE is_system = FALSE AND document_id IS NOT NULL;

--    is_system=FALSE + document_id IS NULL + user_id IS NOT NULL → 用户可复用私有模板 (2)
UPDATE templates SET template_type = 2 WHERE is_system = FALSE AND document_id IS NULL AND user_id IS NOT NULL;

-- 3. 删除旧列
ALTER TABLE templates DROP COLUMN is_system;

COMMIT;
