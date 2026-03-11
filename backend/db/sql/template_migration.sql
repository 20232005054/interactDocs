-- 删除旧的模板表
DROP TABLE IF EXISTS summary_title_templates;
DROP TABLE IF EXISTS document_schema_templates;
DROP TABLE IF EXISTS prompt_templates;

-- 创建新的模板表
CREATE TABLE IF NOT EXISTS templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    user_id UUID REFERENCES users(user_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 为Document表添加template_id字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(template_id);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_templates_purpose ON templates(purpose);
CREATE INDEX IF NOT EXISTS idx_templates_group_id ON templates(group_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);

-- 插入一些系统模板示例
INSERT INTO templates (
    group_id, purpose, display_name, content, version, is_system, is_active
) VALUES
-- 标准医疗报告模板
('00000000-0000-0000-0000-000000000001', '报告', '标准医疗报告', 
 '{"prompt": {"task_type": "generate_paragraph", "system_prompt": "你是一名专业的医疗报告撰写专家", "user_prompt_template": "请根据以下内容生成医疗报告：{{content}}"}, "schema": {"schema_json": [{"title": "摘要", "type": "heading-1"}, {"title": "背景", "type": "heading-1"}, {"title": "方法", "type": "heading-1"}, {"title": "结果", "type": "heading-1"}, {"title": "结论", "type": "heading-1"}]}, "summary": {"title_templates": ["研究背景", "研究目的", "研究方法", "研究结果", "研究结论"]}}', 
 1, TRUE, TRUE),

-- 2077标准医疗器械申报书模板
('00000000-0000-0000-0000-000000000002', '申报', '2077标准医疗器械申报书', 
 '{"prompt": {"task_type": "generate_paragraph", "system_prompt": "你是一名专业的医疗器械申报专家", "user_prompt_template": "请根据以下内容生成医疗器械申报书：{{content}}"}, "schema": {"schema_json": [{"title": "产品概述", "type": "heading-1"}, {"title": "技术要求", "type": "heading-1"}, {"title": "临床评价", "type": "heading-1"}, {"title": "风险管理", "type": "heading-1"}, {"title": "说明书", "type": "heading-1"}]}, "summary": {"title_templates": ["产品背景", "技术特点", "临床效果", "风险控制", "申报结论"]}}', 
 1, TRUE, TRUE);
