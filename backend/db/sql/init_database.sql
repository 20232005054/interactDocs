-- 数据库初始化脚本

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    title VARCHAR(80) NOT NULL,
    keywords TEXT[] NOT NULL,
    abstract TEXT,
    content JSONB DEFAULT '[]',
    purpose VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    snapshot_cursor INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建章节表
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

-- 创建文档版本表
CREATE TABLE IF NOT EXISTS document_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(document_id),
    description VARCHAR(255) NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id)
);

-- 创建操作历史表
CREATE TABLE IF NOT EXISTS operation_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id),
    chapter_id UUID REFERENCES chapters(chapter_id),
    action VARCHAR(50) NOT NULL,
    content_before JSONB DEFAULT '[]',
    content_after JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 AI 评估记录表
CREATE TABLE IF NOT EXISTS ai_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(chapter_id),
    evaluation_result TEXT NOT NULL,
    suggestions TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建聊天记录表
CREATE TABLE IF NOT EXISTS chat_records (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    document_id UUID REFERENCES documents(document_id),
    chapter_id UUID REFERENCES chapters(chapter_id),
    chapter_content JSONB,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    mode VARCHAR(20) DEFAULT 'chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent_id ON chapters(parent_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order_index ON chapters(order_index);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_operation_history_document_id ON operation_history(document_id);
CREATE INDEX IF NOT EXISTS idx_operation_history_chapter_id ON operation_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_chapter_id ON ai_evaluations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_document_id ON chat_records(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_chapter_id ON chat_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_documents_keywords ON documents USING GIN (keywords);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
BEFORE UPDATE ON chapters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
