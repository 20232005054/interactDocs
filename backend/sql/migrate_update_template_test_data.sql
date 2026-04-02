-- =====================================================
-- 迁移脚本：更新测试模板数据
-- 变更内容：
--   1. field_key 统一改为带前缀格式（core_/summary_/struct_）
--   2. sources 里的 match_keys.value 同步更新
--   3. 结构模板提示词改为纯文本（去除{{}}变量）
--   4. 字数要求统一改为100-200字
-- =====================================================

DELETE FROM structure_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM summary_templates   WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM core_info_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

INSERT INTO core_info_templates (core_template_id, template_id, parent_id, field_name, field_key, field_type, default_value, options, is_required, order_index) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL,                                    '试验基本信息', 'core_basicinfo',  'group',  NULL, NULL,                          TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '试验名称',     'core_trialname',  'text',   NULL, NULL,                          TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '申办方',       'core_sponsor',    'text',   NULL, NULL,                          TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', '研究阶段',     'core_phase',      'select', NULL, '["I期","II期","III期","IV期"]', TRUE, 2),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL,                                    '试验设计信息', 'core_designinfo', 'group',  NULL, NULL,                          TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '研究目的',     'core_purpose',    'text',   NULL, NULL,                          TRUE, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '目标人群',     'core_population', 'text',   NULL, NULL,                          TRUE, 1),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '主要终点',     'core_endpoint',   'text',   NULL, NULL,                          TRUE, 2),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', '样本量',       'core_samplesize', 'number', NULL, NULL,                          TRUE, 3);

INSERT INTO summary_templates (summary_template_id, template_id, title, field_key, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '试验名称', 'summary_trialname', 0,
 '{{core_trialname}}',
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_trialname", "label": "试验名称"}], "target_field": "core_trialname"}]',
 NULL, NULL, 0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '申办方', 'summary_sponsor', 0,
 '{{core_sponsor}}',
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_sponsor", "label": "申办方"}], "target_field": "core_sponsor"}]',
 NULL, NULL, 1),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '研究目的', 'summary_purpose', 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_purpose", "label": "研究目的"}], "target_field": "core_purpose"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_endpoint", "label": "主要终点"}], "target_field": "core_endpoint"}]',
 '根据提供的研究目的和主要终点信息，撰写研究目的摘要，100-200字。',
 '作为临床试验专家，请根据研究目的和主要终点，撰写研究目的摘要，语言专业简洁，100-200字。',
 2),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '研究概述', 'summary_overview', 1, NULL,
 '[{"source": {"value": "summary", "label": "摘要信息", "ui_type": "select"}, "match_type": "摘要信息匹配", "match_keys": [{"value": "summary_purpose", "label": "研究目的摘要"}], "target_field": "summary_purpose"}]',
 '根据提供的研究目的摘要，撰写研究概述，突出研究核心价值，100-200字。',
 '综合研究目的摘要，撰写研究概述，突出研究的核心价值，100-200字。',
 3);

INSERT INTO structure_templates (structure_template_id, template_id, parent_id, title, field_key, level, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '研究背景', 'struct_background', 1, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_purpose", "label": "研究目的"}], "target_field": "core_purpose"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_trialname", "label": "试验名称"}], "target_field": "core_trialname"}]',
 '你是一位资深临床试验方案撰写专家。请根据提供的试验名称和研究目的，撰写研究背景章节，阐述疾病现状、现有治疗局限性及本研究的科学依据，语言严谨，100-200字。',
 '你是一位资深临床试验方案撰写专家。请根据提供的试验名称和研究目的，撰写研究背景章节，100-200字。',
 0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '研究设计', 'struct_design', 1, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_purpose", "label": "研究目的"}], "target_field": "core_purpose"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_phase", "label": "研究阶段"}], "target_field": "core_phase"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_population", "label": "目标人群"}], "target_field": "core_population"}]',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究目的、研究阶段和目标人群，撰写研究设计总述，概括研究类型、分期和流程框架，100-200字。',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究目的、研究阶段和目标人群，撰写研究设计总述，100-200字。',
 1),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '统计分析', 'struct_statistics', 1, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_endpoint", "label": "主要终点"}], "target_field": "core_endpoint"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_samplesize", "label": "样本量"}], "target_field": "core_samplesize"}]',
 '你是一位资深生物统计学家。请根据提供的主要终点和样本量，撰写统计分析总述，涵盖分析集定义、主要分析方法和样本量估算依据，符合ICH E9规范，100-200字。',
 '你是一位资深生物统计学家。请根据提供的主要终点和样本量，撰写统计分析总述，100-200字。',
 2),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, '讨论与结论', 'struct_discussion', 1, 1, NULL,
 '[{"source": {"value": "chapter", "label": "章节内容", "ui_type": "select"}, "match_type": "章节信息匹配", "match_keys": [{"value": "struct_design", "label": "研究设计"}], "target_field": "struct_design"}, {"source": {"value": "summary", "label": "摘要信息", "ui_type": "select"}, "match_type": "摘要信息匹配", "match_keys": [{"value": "summary_purpose", "label": "研究目的摘要"}], "target_field": "summary_purpose"}]',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究设计和研究目的摘要，撰写讨论与结论章节，论证设计合理性、预期临床意义及局限性，100-200字。',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究设计和研究目的摘要，撰写讨论与结论章节，100-200字。',
 3);

INSERT INTO structure_templates (structure_template_id, template_id, parent_id, title, field_key, level, generation_mode, content_template, sources, default_prompt, custom_prompt, order_index) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '研究类型', 'struct_restype', 2, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_phase", "label": "研究阶段"}], "target_field": "core_phase"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_purpose", "label": "研究目的"}], "target_field": "core_purpose"}]',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究阶段和研究目的，撰写研究类型小节，明确设计类型及选择依据，100-200字。',
 '你是一位资深临床试验方案撰写专家。请根据提供的研究阶段和研究目的，撰写研究类型小节，100-200字。',
 0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '样本量估算', 'struct_samplesize', 2, 0,
 '本研究计划纳入{{core_samplesize}}例受试者。',
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_samplesize", "label": "样本量"}], "target_field": "core_samplesize"}]',
 NULL, NULL, 1),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '入排标准', 'struct_eligibility', 2, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_population", "label": "目标人群"}], "target_field": "core_population"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_phase", "label": "研究阶段"}], "target_field": "core_phase"}]',
 '你是一位资深临床试验方案撰写专家。请根据提供的目标人群和研究阶段，撰写入排标准小节，分别列出3-5条纳入标准和3-5条排除标准，符合GCP规范，100-200字。',
 '你是一位资深临床试验方案撰写专家。请根据提供的目标人群和研究阶段，撰写入排标准小节，100-200字。',
 2),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', '主要分析', 'struct_primaryana', 2, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_endpoint", "label": "主要终点"}], "target_field": "core_endpoint"}, {"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_samplesize", "label": "样本量"}], "target_field": "core_samplesize"}]',
 '你是一位资深生物统计学家。请根据提供的主要终点和样本量，撰写主要分析小节，明确统计假设、检验方法和显著性水平，符合ICH E9规范，100-200字。',
 '你是一位资深生物统计学家。请根据提供的主要终点和样本量，撰写主要分析小节，100-200字。',
 0),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', '次要分析', 'struct_secondaryara', 2, 1, NULL,
 '[{"source": {"value": "keyinfo", "label": "关键信息", "ui_type": "select"}, "match_type": "关键信息匹配", "match_keys": [{"value": "core_endpoint", "label": "主要终点"}], "target_field": "core_endpoint"}]',
 '你是一位资深生物统计学家。请根据提供的主要终点，撰写次要分析小节，涵盖次要终点分析方法和探索性分析计划，100-200字。',
 '你是一位资深生物统计学家。请根据提供的主要终点，撰写次要分析小节，100-200字。',
 1);
