-- 迁移脚本：StructureTemplate 重构为多段落结构
-- 执行步骤：
--   1. 新增 paragraphs 列
--   2. 将现有顶层字段打包为 paragraphs[0]
--   3. 原字段置空（列保留，不删除）
--
-- 执行方式：psql -d <database> -f migrate_structure_template_paragraphs.sql

-- 步骤 1：新增 paragraphs 列（已存在则跳过）
ALTER TABLE structure_templates
    ADD COLUMN IF NOT EXISTS paragraphs JSONB;

-- 步骤 2 & 3：打包旧字段为 paragraphs[0]，原字段置空
UPDATE structure_templates
SET
    paragraphs = jsonb_build_array(
        jsonb_strip_nulls(
            jsonb_build_object(
                'para_type',        'paragraph',
                'content_template', content_template,
                'generation_mode',  COALESCE(generation_mode, 0),
                'sources',          sources,
                'default_prompt',   default_prompt,
                'custom_prompt',    custom_prompt
            )
        )
    ),
    content_template = NULL,
    sources          = NULL,
    default_prompt   = NULL,
    custom_prompt    = NULL
WHERE paragraphs IS NULL;

-- 验证：查看迁移结果
-- SELECT structure_template_id, title, paragraphs, content_template
-- FROM structure_templates
-- LIMIT 10;

-- 步骤 4：paragraphs 表新增 para_def_idx 列（已存在则跳过）
ALTER TABLE paragraphs
    ADD COLUMN IF NOT EXISTS para_def_idx INTEGER;
