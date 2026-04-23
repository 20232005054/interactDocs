-- ============================================
-- 迁移：新增文献 RAG 系统（三张表）
-- 执行前提：pgvector 扩展已安装（CREATE EXTENSION vector）
-- ============================================

-- 确保 pgvector 扩展已开启
CREATE EXTENSION IF NOT EXISTS vector;

-- 7.1 文献主表
CREATE TABLE IF NOT EXISTS literature (
    literature_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    title           VARCHAR(500),
    authors         TEXT,
    journal         VARCHAR(200),
    publish_date    TIMESTAMP,
    doi             VARCHAR(100),
    impact_factor   FLOAT,
    source_file     VARCHAR(500),
    upload_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 7.2 文献分块向量表
CREATE TABLE IF NOT EXISTS literature_chunks (
    chunk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    literature_id   UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    section_type    VARCHAR(30),
    content         TEXT NOT NULL,
    embedding       vector(1024),
    chunk_index     INTEGER NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 7.3 文档引用关联表
CREATE TABLE IF NOT EXISTS document_citations (
    citation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL,
    source_id       UUID NOT NULL,
    literature_id   UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    citation_number INTEGER NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_literature_template_id ON literature(template_id);
CREATE INDEX IF NOT EXISTS idx_literature_upload_status ON literature(upload_status);
CREATE INDEX IF NOT EXISTS idx_literature_chunks_embedding
    ON literature_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_literature_chunks_literature_id ON literature_chunks(literature_id);
CREATE INDEX IF NOT EXISTS idx_document_citations_document_id ON document_citations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_citations_source ON document_citations(source_type, source_id);
