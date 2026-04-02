-- 为 document_core_info 表添加 field_key 字段
ALTER TABLE document_core_info
    ADD COLUMN IF NOT EXISTS field_key VARCHAR(50);
