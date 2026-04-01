-- 直接用database就行
-- Migration script to add field_type, options, and is_required to document_core_info

ALTER TABLE document_core_info
ADD COLUMN IF NOT EXISTS field_type VARCHAR(20) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS options JSONB,
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE;
