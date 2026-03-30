-- ============================================
-- InteractiveDocs 数据库初始化脚本
-- 数据库名: agent02
-- ============================================

-- 第一步：删除并重建数据库（需要连接到 postgres 默认库）
-- DROP DATABASE IF EXISTS agent02;
-- CREATE DATABASE agent02;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 文档核心表（先于模板表创建，因为模板表引用文档表）
-- ============================================

-- 2.1 文档主表
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    template_id UUID,
    title VARCHAR(200) NOT NULL,
    purpose VARCHAR(100),
    snapshot_cursor INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 章节表 (自关联父子关系)
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT '',
    status INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 段落表
CREATE TABLE IF NOT EXISTS paragraphs (
    paragraph_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    para_type VARCHAR(20) NOT NULL,
    order_index INTEGER NOT NULL,
    ai_eval TEXT,
    ai_suggestion TEXT,
    ai_generate TEXT,
    ischange INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- 3. 版本与历史
-- ============================================

-- 3.1 文档版本快照
CREATE TABLE IF NOT EXISTS document_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id)
);

-- 3.2 操作历史记录
CREATE TABLE IF NOT EXISTS operation_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    content_before TEXT,
    content_after TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 AI对话记录
CREATE TABLE IF NOT EXISTS chat_records (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id),
    chapter_id UUID REFERENCES chapters(chapter_id),
    chapter_content JSONB,
    message TEXT NOT NULL,
    response TEXT,
    mode VARCHAR(20) DEFAULT 'chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. 摘要与核心信息
-- ============================================

-- 4.1 文档摘要
CREATE TABLE IF NOT EXISTS document_summaries (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_change INTEGER NOT NULL DEFAULT 0,
    ai_generate TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 摘要历史
CREATE TABLE IF NOT EXISTS document_summary_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID NOT NULL REFERENCES document_summaries(summary_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.3 文档核心信息
CREATE TABLE IF NOT EXISTS document_core_info (
    core_info_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    field_type VARCHAR(20) DEFAULT 'text',
    options JSONB,
    is_required BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_change INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 文档模板系统 (4层架构，引用文档表)
-- ============================================

-- 5.1 模板主表（document_id 为外键引用 documents）
CREATE TABLE IF NOT EXISTS templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5.2 核心信息模板
CREATE TABLE IF NOT EXISTS core_info_templates (
    core_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_key VARCHAR(50) NOT NULL,
    field_type VARCHAR(20) DEFAULT 'text',
    default_value TEXT,
    options JSONB,
    is_required BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5.3 摘要模板
CREATE TABLE IF NOT EXISTS summary_templates (
    summary_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    field_key VARCHAR(50) NOT NULL,
    generation_mode INTEGER DEFAULT 0,
    content_template TEXT,
    sources JSONB,
    default_prompt TEXT,
    custom_prompt TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5.4 结构模板 (树形自关联)
CREATE TABLE IF NOT EXISTS structure_templates (
    structure_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES structure_templates(structure_template_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    field_key VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    generation_mode INTEGER DEFAULT 0,
    content_template TEXT,
    sources JSONB,
    default_prompt TEXT,
    custom_prompt TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. 知识图谱
-- ============================================

-- 6.1 依赖边表 (异构关联)
CREATE TABLE IF NOT EXISTS dependency_edges (
    edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(30) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    target_version INTEGER,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引创建
-- ============================================

-- documents 索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);

-- chapters 索引
CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id ON chapters(parent_id);

-- paragraphs 索引
CREATE INDEX IF NOT EXISTS idx_paragraphs_chapter_id ON paragraphs(chapter_id);

-- operation_history 索引
CREATE INDEX IF NOT EXISTS idx_operation_history_chapter_id ON operation_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_operation_history_document_id ON operation_history(document_id);

-- chat_records 索引
CREATE INDEX IF NOT EXISTS idx_chat_records_document_id ON chat_records(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_chapter_id ON chat_records(chapter_id);

-- document_summaries 索引
CREATE INDEX IF NOT EXISTS idx_document_summaries_document_id ON document_summaries(document_id);

-- templates 索引
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_group_id ON templates(group_id);
CREATE INDEX IF NOT EXISTS idx_templates_document_id ON templates(document_id);

-- core_info_templates 索引
CREATE INDEX IF NOT EXISTS idx_core_info_templates_template_id ON core_info_templates(template_id);

-- summary_templates 索引
CREATE INDEX IF NOT EXISTS idx_summary_templates_template_id ON summary_templates(template_id);

-- structure_templates 索引
CREATE INDEX IF NOT EXISTS idx_structure_templates_template_id ON structure_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_structure_templates_parent_id ON structure_templates(parent_id);

-- dependency_edges 索引
CREATE INDEX IF NOT EXISTS idx_dependency_edges_source ON dependency_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_target ON dependency_edges(target_type, target_id);
