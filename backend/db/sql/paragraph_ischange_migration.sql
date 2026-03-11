-- 为段落表添加ischange字段
ALTER TABLE paragraphs ADD COLUMN IF NOT EXISTS ischange INTEGER NOT NULL DEFAULT 0;