-- ============================================
-- 数据库迁移脚本
-- 目标：为 document_summaries 和 document_summary_history 表增加 field_key 字段
-- 适用情况：表内暂无数据
-- ============================================

-- 1. 为 document_summaries 增加 field_key 字段
ALTER TABLE document_summaries ADD COLUMN field_key VARCHAR(50) NOT NULL;

-- 2. 为 document_summary_history 增加 field_key 字段
ALTER TABLE document_summary_history ADD COLUMN field_key VARCHAR(50) NOT NULL;

-- 可选：如果您需要为其添加索引以加快基于 field_key 的查询（如在建立依赖或变量替换时）
-- CREATE INDEX IF NOT EXISTS idx_document_summaries_field_key ON document_summaries(field_key);
