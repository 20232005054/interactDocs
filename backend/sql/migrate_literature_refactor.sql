-- ============================================
-- 文献模块重构迁移脚本
-- 描述：将文献从"模板附属"改为"独立知识库+关联表"
-- 执行前提：已备份数据库
-- ============================================

-- ============================================
-- [测试环境] 清空相关表，重新初始化
-- 生产环境请注释掉这一段，直接从 BEGIN 开始执行
-- ============================================

DROP TABLE IF EXISTS document_citations CASCADE;
DROP TABLE IF EXISTS literature_chunks CASCADE;
DROP TABLE IF EXISTS template_literature CASCADE;
DROP TABLE IF EXISTS literature CASCADE;

-- ============================================

BEGIN;

-- ============================================
-- Step 1: literature 表新增字段
-- ============================================

ALTER TABLE literature
    ADD COLUMN IF NOT EXISTS scope   VARCHAR(20) NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id);

-- 将现有文献全部标记为 public（存量数据由 admin/editor 维护）
UPDATE literature SET scope = 'public' WHERE scope = 'private';

-- ============================================
-- Step 2: 新建 template_literature 关联表
-- ============================================

CREATE TABLE IF NOT EXISTS template_literature (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id   UUID NOT NULL REFERENCES templates(template_id) ON DELETE CASCADE,
    literature_id UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (template_id, literature_id)
);

-- ============================================
-- Step 3: 将现有 literature.template_id 数据迁移到关联表
-- ============================================

INSERT INTO template_literature (template_id, literature_id)
SELECT template_id, literature_id
FROM literature
WHERE template_id IS NOT NULL
ON CONFLICT (template_id, literature_id) DO NOTHING;

-- ============================================
-- Step 4: 删除 literature.template_id 外键约束和列
-- ============================================

-- 先找到并删除外键约束（约束名可能因环境不同而异，用 DO 块兼容处理）
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'literature'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'template_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE literature DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE literature DROP COLUMN IF EXISTS template_id;

-- ============================================
-- Step 5: 新增索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_literature_scope
    ON literature(scope);

CREATE INDEX IF NOT EXISTS idx_literature_user_id
    ON literature(user_id);

CREATE INDEX IF NOT EXISTS idx_template_literature_template_id
    ON template_literature(template_id);

CREATE INDEX IF NOT EXISTS idx_template_literature_literature_id
    ON template_literature(literature_id);

-- 删除旧的 template_id 索引（已无此列）
DROP INDEX IF EXISTS idx_literature_template_id;

-- ============================================
-- Step 6: 新增 literature_key 字段
-- ============================================

ALTER TABLE literature
    ADD COLUMN IF NOT EXISTS literature_key VARCHAR(20);

-- 为存量数据生成 literature_key（格式：lit_ + 8位hex）
UPDATE literature
SET literature_key = 'lit_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE literature_key IS NULL;

-- 设置非空约束和唯一约束
ALTER TABLE literature
    ALTER COLUMN literature_key SET NOT NULL;

ALTER TABLE literature
    ADD CONSTRAINT uq_literature_key UNIQUE (literature_key);

CREATE INDEX IF NOT EXISTS idx_literature_key ON literature(literature_key);
CREATE INDEX IF NOT EXISTS idx_literature_doi ON literature(doi);

-- ============================================
-- 完成
-- ============================================

COMMIT;
