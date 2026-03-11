-- 创建提示词模板表
CREATE TABLE IF NOT EXISTS prompt_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建文档结构模板表
CREATE TABLE IF NOT EXISTS document_schema_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purpose VARCHAR(50) NOT NULL,
    schema_json JSONB NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prompt_templates_task_type ON prompt_templates(task_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_purpose ON prompt_templates(purpose);
CREATE INDEX IF NOT EXISTS idx_document_schema_templates_purpose ON document_schema_templates(purpose);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_prompt_templates_updated_at
BEFORE UPDATE ON prompt_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_schema_templates_updated_at
BEFORE UPDATE ON document_schema_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 插入默认提示词模板
INSERT INTO prompt_templates (task_type, purpose, system_prompt, user_prompt_template)
VALUES
('assist', '通用', '你是一个专业的临床试验方案辅助撰写助手。', '你是一位资深的临床研究方案撰写专家。\n项目标题：{{ title }}\n研究关键词：{{ keywords }}\n章节标题：{{ chapter_title }}\n{% if hierarchy_titles %}\n层级标题：\n{% for t in hierarchy_titles %}\n{{ t["type"].replace("heading-", "H") }}: {{ t["content"] }}\n{% endfor %}\n{% endif %}\n{% if summary_sections %}\n摘要信息：\n{{ summary_sections }}\n{% endif %}\n{% if current_content %}\n当前段落内容：{{ current_content }}\n{% endif %}\n当前任务：请基于以上信息，为该段落撰写专业的内容。\n要求：符合临床研究规范，逻辑严密，语言专业，直接输出段落内容，使用纯文本格式，不要使用Markdown格式，不要重复标题信息。'),
('evaluate', '通用', '你是一个专业的临床试验方案评估专家。', '你是一位资深的临床研究方案评估专家。\n请对以下段落内容进行专业评估：\n\n项目标题：{{ title }}\n研究关键词：{{ keywords }}\n章节标题：{{ chapter_title }}\n{% if hierarchy_titles %}\n层级标题：\n{% for t in hierarchy_titles %}\n{{ t["type"].replace("heading-", "H") }}: {{ t["content"] }}\n{% endfor %}\n{% endif %}\n{% if summary_sections %}\n摘要信息：\n{{ summary_sections }}\n{% endif %}\n段落标题：{{ paragraph_title }}\n段落内容：{{ paragraph_content }}\n\n评估要求：\n1. 分析内容的专业性、完整性和逻辑性\n2. 给出具体的评估结果\n3. 提供至少3条改进建议\n4. 评估结果和建议要具体、实用\n5. 使用纯文本格式，不要使用Markdown格式，不要使用任何标题符号、列表符号或格式标记\n6. 直接输出评估结果和建议，不要有任何引言或开场白'),
('revision', '通用', '你是一位资深的临床研究方案修订专家。', '你是一位资深的临床研究方案修订专家。\n请根据以下指令修订章节内容：\n\n修订指令：{{ instruction }}\n\n当前章节内容：\n{{ text_content }}\n\n修订要求：\n1. 严格按照指令进行修订\n2. 保持内容的专业性和逻辑性\n3. 直接输出修订后的完整内容\n4. 不要添加任何额外的说明或解释'),
('generate_chapters', '通用', '你是一个专业的临床试验方案辅助撰写助手。', '你是一位资深的临床研究方案撰写专家。\n项目标题：{{ title }}\n研究关键词：{{ keywords }}\n{% if abstract %}\n正文摘要：{{ abstract }}\n{% endif %}\n{% if content %}\n参考正文：{{ content }}\n{% endif %}\n{% if purpose %}\n使用目的：{{ purpose }}\n{% endif %}\n当前任务：请根据以上信息，为该临床研究方案生成一个合理的章节结构，只需要输出章节标题列表。\n要求：\n1. 章节结构要符合临床研究方案的规范\n2. 章节标题要具体、专业，能够涵盖研究的主要内容\n3. 章节数量要合理，通常为 3-8 个章节\n4. 只输出章节标题列表，每个标题占一行，不要添加任何序号或其他内容');

-- 插入默认文档结构模板
INSERT INTO document_schema_templates (purpose, schema_json, description)
VALUES
('通用', '[{"title": "项目核心信息", "order_index": 1}, {"title": "方案摘要", "order_index": 2}, {"title": "研究背景", "order_index": 3}, {"title": "研究目的", "order_index": 4}, {"title": "研究方法", "order_index": 5}, {"title": "数据管理", "order_index": 6}, {"title": "伦理考虑", "order_index": 7}, {"title": "研究预期结果", "order_index": 8}]', '通用临床研究方案结构模板'),
('医疗器械临床申报', '[{"title": "项目概述", "order_index": 1}, {"title": "研究背景与依据", "order_index": 2}, {"title": "研究目的", "order_index": 3}, {"title": "研究设计", "order_index": 4}, {"title": "受试者选择", "order_index": 5}, {"title": "研究流程", "order_index": 6}, {"title": "安全性评估", "order_index": 7}, {"title": "有效性评估", "order_index": 8}, {"title": "数据管理与统计分析", "order_index": 9}, {"title": "伦理与知情同意", "order_index": 10}, {"title": "研究管理", "order_index": 11}, {"title": "预期结果与风险控制", "order_index": 12}]', '医疗器械临床申报方案结构模板');
