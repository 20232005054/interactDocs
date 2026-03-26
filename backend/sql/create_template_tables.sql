-- =====================================================
-- 模板机制升级 - 建表SQL语句
-- =====================================================

-- 1. 核心信息模板表
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

COMMENT ON TABLE core_info_templates IS '核心信息模板表';
COMMENT ON COLUMN core_info_templates.core_template_id IS '主键ID';
COMMENT ON COLUMN core_info_templates.template_id IS '关联的主模板ID';
COMMENT ON COLUMN core_info_templates.field_name IS '字段名称（如：试验名称）';
COMMENT ON COLUMN core_info_templates.field_key IS '字段标识（如：trial_name）';
COMMENT ON COLUMN core_info_templates.field_type IS '字段类型：text/number/date/select';
COMMENT ON COLUMN core_info_templates.default_value IS '默认值';
COMMENT ON COLUMN core_info_templates.options IS 'select类型的选项列表';
COMMENT ON COLUMN core_info_templates.is_required IS '是否必填';
COMMENT ON COLUMN core_info_templates.order_index IS '排序索引';

-- 2. 摘要模板表
CREATE TABLE IF NOT EXISTS summary_templates (
    summary_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    generation_mode INTEGER DEFAULT 0,
    content_template TEXT,
    sources JSONB,
    default_prompt TEXT,
    custom_prompt TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE summary_templates IS '摘要模板表';
COMMENT ON COLUMN summary_templates.summary_template_id IS '主键ID';
COMMENT ON COLUMN summary_templates.template_id IS '关联的主模板ID';
COMMENT ON COLUMN summary_templates.title IS '摘要标题';
COMMENT ON COLUMN summary_templates.generation_mode IS '生成方式：0=复制，1=AI总结';
COMMENT ON COLUMN summary_templates.content_template IS '内容模板，支持{{变量名}}替换';
COMMENT ON COLUMN summary_templates.sources IS '来源信息数组';
COMMENT ON COLUMN summary_templates.default_prompt IS '默认AI提示词';
COMMENT ON COLUMN summary_templates.custom_prompt IS '专属AI提示词（优先使用）';
COMMENT ON COLUMN summary_templates.order_index IS '排序索引';

-- 3. 文章结构模板表
CREATE TABLE IF NOT EXISTS structure_templates (
    structure_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES structure_templates(structure_template_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
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

COMMENT ON TABLE structure_templates IS '文章结构模板表';
COMMENT ON COLUMN structure_templates.structure_template_id IS '主键ID';
COMMENT ON COLUMN structure_templates.template_id IS '关联的主模板ID';
COMMENT ON COLUMN structure_templates.parent_id IS '父章节ID';
COMMENT ON COLUMN structure_templates.title IS '章节标题';
COMMENT ON COLUMN structure_templates.level IS '层级：1=一级标题，2=二级标题...';
COMMENT ON COLUMN structure_templates.generation_mode IS '生成方式：0=复制，1=AI总结';
COMMENT ON COLUMN structure_templates.content_template IS '内容模板';
COMMENT ON COLUMN structure_templates.sources IS '来源信息数组';
COMMENT ON COLUMN structure_templates.default_prompt IS '默认AI提示词';
COMMENT ON COLUMN structure_templates.custom_prompt IS '专属AI提示词';
COMMENT ON COLUMN structure_templates.order_index IS '排序索引';

-- 创建索引
CREATE INDEX idx_core_info_templates_template_id ON core_info_templates(template_id);
CREATE INDEX idx_summary_templates_template_id ON summary_templates(template_id);
CREATE INDEX idx_structure_templates_template_id ON structure_templates(template_id);
CREATE INDEX idx_structure_templates_parent_id ON structure_templates(parent_id);
