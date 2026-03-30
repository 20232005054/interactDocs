-- migration_add_field_key_to_templates.sql
-- 为 summary_templates 和 structure_templates 表添加 field_key 字段

-- 1. 为 summary_templates 添加 field_key 字段
ALTER TABLE summary_templates 
ADD COLUMN IF NOT EXISTS field_key VARCHAR(50) NOT NULL DEFAULT gen_random_uuid()::varchar(50);

-- 2. 为 structure_templates 添加 field_key 字段
ALTER TABLE structure_templates 
ADD COLUMN IF NOT EXISTS field_key VARCHAR(50) NOT NULL DEFAULT gen_random_uuid()::varchar(50);
