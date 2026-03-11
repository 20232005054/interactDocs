-- 将摘要表的content字段从JSONB类型改为TEXT类型
ALTER TABLE document_summaries ALTER COLUMN content TYPE TEXT USING content::text;

-- 将摘要-段落关联表的summary_sections字段从JSONB类型改为TEXT类型
ALTER TABLE paragraph_summary_links ALTER COLUMN summary_sections TYPE TEXT USING summary_sections::text;