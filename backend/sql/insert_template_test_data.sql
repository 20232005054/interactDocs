-- =====================================================
-- 模板机制升级 - 测试数据SQL语句
-- =====================================================

-- 假设已存在一个系统模板，template_id 为 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
-- 如果没有，先创建一个测试用的主模板

-- 1. 创建测试主模板（如果不存在）
INSERT INTO templates (template_id, group_id, purpose, display_name, content, version, is_system, is_active)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    '临床试验方案',
    '肿瘤临床试验方案模板',
    '{"description": "用于肿瘤临床试验方案的撰写", "default_prompt": "你是一位专业的临床试验方案撰写专家，请根据提供的信息撰写章节内容。"}',
    1,
    TRUE,
    TRUE
) ON CONFLICT (template_id) DO NOTHING;

-- 清理旧数据以防止主键冲突
DELETE FROM structure_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM summary_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM core_info_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- 2. 插入核心信息模板测试数据
INSERT INTO core_info_templates (core_template_id, template_id, parent_id, field_name, field_key, field_type, default_value, options, is_required, order_index) VALUES
-- 一级目录：试验基本信息
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '试验基本信息', 'group_basic_info', 'group', NULL, NULL, TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '试验名称', 'trial_name', 'text', NULL, NULL, TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '申办方', 'sponsor', 'text', NULL, NULL, TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '研究阶段', 'trial_phase', 'select', NULL, '["I期", "II期", "III期", "IV期"]', TRUE, 2),

-- 一级目录：试验设计信息
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '试验设计信息', 'group_design_info', 'group', NULL, NULL, TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '研究目的', 'trial_purpose', 'text', NULL, NULL, TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '目标人群', 'target_population', 'text', NULL, NULL, TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '主要终点', 'primary_endpoint', 'text', NULL, NULL, TRUE, 2),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '样本量', 'sample_size', 'number', NULL, NULL, TRUE, 3);

-- 3. 插入摘要模板测试数据
-- 复制模式示例（generation_mode=0）
INSERT INTO summary_templates (summary_template_id, template_id, title, field_key, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '试验名称', 'sum_trial_name', 0, '{{trial_name}}', 
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "trial_name", "label": "试验名称"}], "target_field": "trial_name"}]',
NULL, NULL, 0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '申办方', 'sum_sponsor', 0, '{{sponsor}}',
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "sponsor", "label": "申办方"}], "target_field": "sponsor"}]',
NULL, NULL, 1);

-- AI生成模式示例（generation_mode=1，引用核心信息）
INSERT INTO summary_templates (summary_template_id, template_id, title, field_key, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '研究目的', 'sum_research_purpose', 1, NULL, 
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "trial_purpose", "label": "研究目的"}], "target_field": "trial_purpose"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "primary_endpoint", "label": "主要终点"}], "target_field": "primary_endpoint"}]',
'根据以下核心信息，撰写研究目的摘要：\n研究目的：{{trial_purpose}}\n主要终点：{{primary_endpoint}}',
'作为临床试验专家，请根据研究目的和主要终点，撰写一段100-150字的研究目的摘要，要求语言专业、逻辑清晰。',
2);

-- AI生成模式示例（generation_mode=1，引用其他摘要）
INSERT INTO summary_templates (summary_template_id, template_id, title, field_key, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '研究概述', 'sum_research_overview', 1, NULL,
'[{"source": {"value": "summary", "label": "摘要信息", "ui_type": "select"}, "match_type": "摘要信息匹配", "match_keys": [{"value": "sum_research_purpose", "label": "研究目的摘要"}], "target_field": "research_purpose"}]',
'请根据以下摘要信息，撰写研究概述：\n{{research_purpose}}',
'综合研究目的摘要，撰写一段200字的研究概述，突出研究的核心价值。',
3);

-- 4. 插入文章结构模板测试数据
-- 一级标题
INSERT INTO structure_templates (structure_template_id, template_id, parent_id, title, field_key, level, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '研究背景', 'chp_research_background', 1, 1, NULL, 
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "trial_purpose", "label": "研究目的"}], "target_field": "trial_purpose"}]',
'根据研究目的撰写研究背景...',
'作为临床试验专家，请根据研究目的撰写研究背景，包括疾病现状、研究意义等内容。',
0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '研究设计', 'chp_research_design', 1, 1, NULL, NULL, '根据核心信息撰写研究设计章节...', NULL, 1),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '统计分析', 'chp_statistical_analysis', 1, 1, NULL, NULL, '撰写统计分析章节...', NULL, 2),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '讨论与结论', 'chp_discussion_conclusion', 1, 1, NULL,
'[{"source": {"value": "chapter", "label": "章节内容", "ui_type": "select"}, "match_type": "章节信息匹配", "match_keys": [{"value": "chp_research_design", "label": "研究设计"}], "target_field": "research_design"}, {"source": {"value": "summary", "label": "摘要信息", "ui_type": "select"}, "match_type": "摘要信息匹配", "match_keys": [{"value": "sum_research_purpose", "label": "研究目的摘要"}], "target_field": "research_purpose"}]',
'根据研究结果撰写讨论与结论...',
'综合研究设计和研究目的，撰写讨论与结论章节。',
3);

-- 二级标题（研究设计的子章节）
INSERT INTO structure_templates (structure_template_id, template_id, parent_id, title, field_key, level, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '研究类型', 'chp_research_type', 2, 1, NULL, NULL, '撰写研究类型说明...', NULL, 0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '样本量估算', 'chp_sample_size', 2, 0,
'本研究计划纳入{{sample_size}}例受试者。',
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "sample_size", "label": "样本量"}], "target_field": "sample_size"}]',
NULL, NULL, 1),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '入排标准', 'chp_eligibility_criteria', 2, 1, NULL,
'[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "target_population", "label": "目标人群"}], "target_field": "target_population"}]',
'根据目标人群撰写入排标准...',
NULL, 2);

-- 二级标题（统计分析的子章节）
INSERT INTO structure_templates (structure_template_id, template_id, parent_id, title, field_key, level, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', '主要分析', 'chp_primary_analysis', 2, 1, NULL, NULL, '撰写主要分析方法...', NULL, 0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', '次要分析', 'chp_secondary_analysis', 2, 1, NULL, NULL, '撰写次要分析方法...', NULL, 1);
