-- 删除现有章节表
DROP TABLE IF EXISTS chapters;

-- 创建新的章节表
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES chapters(chapter_id) ON DELETE SET NULL DEFAULT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    content JSONB DEFAULT '[]'::JSONB,
    status VARCHAR(30) DEFAULT 'editing',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id ON chapters(parent_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order_index ON chapters(order_index);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_chapters_updated_at
BEFORE UPDATE ON chapters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
