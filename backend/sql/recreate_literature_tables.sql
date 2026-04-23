-- ============================================
-- 文献相关表重建脚本（测试环境 / 空表重置用）
-- 执行前提：literature / literature_chunks /
--           document_citations / template_literature
--           均为空表或可以丢弃
-- ============================================

-- 按依赖顺序删除
DROP TABLE IF EXISTS document_citations CASCADE;
DROP TABLE IF EXISTS literature_chunks CASCADE;
DROP TABLE IF EXISTS template_literature CASCADE;
DROP TABLE IF EXISTS literature CASCADE;

-- ============================================
-- 重建 literature 主表
-- ============================================
CREATE TABLE literature (
    literature_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    literature_key  VARCHAR(20) NOT NULL UNIQUE,
    title           VARCHAR(500),
    authors         TEXT,
    journal         VARCHAR(200),
    publish_date    TIMESTAMP,
    doi             VARCHAR(100),
    impact_factor   FLOAT,
    source_file     VARCHAR(500),
    -- upload_status: pending / processing / ready / failed
    upload_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    -- scope: public=admin/editor 维护, private=用户私有
    scope           VARCHAR(20) NOT NULL DEFAULT 'private',
    user_id         UUID REFERENCES users(user_id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 重建 template_literature 关联表
-- ============================================
CREATE TABLE template_literature (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    literature_id   UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (template_id, literature_id)
);

-- ============================================
-- 重建 literature_chunks 向量表
-- ============================================
CREATE TABLE literature_chunks (
    chunk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    literature_id   UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    -- section_type: abstract / intro / method / result / conclusion / other
    section_type    VARCHAR(30),
    content         TEXT NOT NULL,
    embedding       vector(1024),
    chunk_index     INTEGER NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 重建 document_citations 引用关联表
-- ============================================
CREATE TABLE document_citations (
    citation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    -- source_type: paragraph / summary
    source_type     VARCHAR(20) NOT NULL,
    source_id       UUID NOT NULL,
    literature_id   UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    citation_number INTEGER NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================

-- literature
CREATE INDEX idx_literature_scope        ON literature(scope);
CREATE INDEX idx_literature_user_id      ON literature(user_id);
CREATE INDEX idx_literature_upload_status ON literature(upload_status);
CREATE INDEX idx_literature_key          ON literature(literature_key);
CREATE INDEX idx_literature_doi          ON literature(doi);

-- template_literature
CREATE INDEX idx_template_literature_template_id   ON template_literature(template_id);
CREATE INDEX idx_template_literature_literature_id ON template_literature(literature_id);

-- literature_chunks 向量检索索引
CREATE INDEX idx_literature_chunks_embedding
    ON literature_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX idx_literature_chunks_literature_id ON literature_chunks(literature_id);

-- document_citations
CREATE INDEX idx_document_citations_document_id ON document_citations(document_id);
CREATE INDEX idx_document_citations_source      ON document_citations(source_type, source_id);
