-- 创建摘要标题模板表
CREATE TABLE IF NOT EXISTS summary_title_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purpose VARCHAR(50) NOT NULL,
    title_templates JSONB NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_summary_title_templates_purpose ON summary_title_templates(purpose);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_summary_title_templates_updated_at
BEFORE UPDATE ON summary_title_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 插入默认摘要标题模板数据
INSERT INTO summary_title_templates (purpose, title_templates, description)
VALUES
('通用', '["研究背景", "研究目的", "研究方法", "数据管理", "伦理考虑", "预期结果"]', '通用临床研究方案摘要标题模板'),
('医疗器械临床申报', '["产品概述", "研究背景", "研究目的", "研究设计", "受试者选择", "安全性评估", "有效性评估", "数据管理"]', '医疗器械临床申报方案摘要标题模板'),
('药物临床试验', '["试验背景", "试验目的", "试验设计", "受试者选择", "给药方案", "疗效评估", "安全性评估", "统计分析"]', '药物临床试验方案摘要标题模板'),
('学术研究', '["研究背景", "研究问题", "研究目的", "研究方法", "研究设计", "数据分析", "预期结果", "结论"]', '学术研究方案摘要标题模板');
