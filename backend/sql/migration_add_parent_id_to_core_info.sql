-- ============================================
-- 数据库迁移：添加 parent_id 字段
-- 目标表：document_core_info, core_info_templates
-- 用途：支持核心信息的树形层级结构
-- ============================================

-- 1. 为 document_core_info 添加 parent_id 字段及外键约束
ALTER TABLE document_core_info
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES document_core_info(core_info_id) ON DELETE CASCADE;

-- 2. 为 document_core_info 添加索引
CREATE INDEX IF NOT EXISTS idx_document_core_info_document_id ON document_core_info(document_id);
CREATE INDEX IF NOT EXISTS idx_document_core_info_parent_id ON document_core_info(parent_id);

-- 3. 为 core_info_templates 添加 parent_id 字段及外键约束
ALTER TABLE core_info_templates
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES core_info_templates(core_template_id) ON DELETE CASCADE;

-- 4. 为 core_info_templates 添加索引
CREATE INDEX IF NOT EXISTS idx_core_info_templates_parent_id ON core_info_templates(parent_id);
