-- 1. 创建段落表
CREATE TABLE IF NOT EXISTS paragraphs (
    paragraph_id UUID PRIMARY KEY,
    chapter_id UUID NOT NULL,
    content TEXT NOT NULL,
    para_type VARCHAR(20) NOT NULL,
    order_index INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    ai_eval TEXT,
    ai_suggestion TEXT,
    FOREIGN KEY (chapter_id) REFERENCES chapters(chapter_id) ON DELETE CASCADE
);

-- 2. 修改章节表，移除content字段
ALTER TABLE chapters DROP COLUMN IF EXISTS content;
ALTER TABLE chapters DROP COLUMN IF EXISTS status;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_paragraphs_chapter_id ON paragraphs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_order_index ON paragraphs(chapter_id, order_index);