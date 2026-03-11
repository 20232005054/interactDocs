-- 创建摘要表
CREATE TABLE IF NOT EXISTS document_summaries (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建摘要-段落关联表
CREATE TABLE IF NOT EXISTS paragraph_summary_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID REFERENCES paragraphs(paragraph_id) ON DELETE CASCADE,
    summary_id UUID REFERENCES document_summaries(summary_id) ON DELETE CASCADE,
    summary_version INTEGER NOT NULL,
    summary_sections JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_summaries_document_id ON document_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_summary_links_paragraph_id ON paragraph_summary_links(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_summary_links_summary_id ON paragraph_summary_links(summary_id);
