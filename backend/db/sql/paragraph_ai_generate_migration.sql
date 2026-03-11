-- 为段落表添加ai_generate字段
ALTER TABLE paragraphs ADD COLUMN IF NOT EXISTS ai_generate TEXT;
