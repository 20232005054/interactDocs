-- ============================================================
-- 迁移脚本：添加段落级文献绑定功能
-- 版本：001
-- 日期：2026-04-29
-- 描述：新增段落-文献关联表，支持段落级文献绑定
-- ============================================================

-- 1. 创建段落-文献关联表
CREATE TABLE IF NOT EXISTS paragraph_literature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paragraph_id UUID NOT NULL REFERENCES paragraphs(paragraph_id) ON DELETE CASCADE,
    literature_id UUID NOT NULL REFERENCES literature(literature_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束：同一段落不能重复绑定同一文献
    CONSTRAINT uk_paragraph_literature UNIQUE (paragraph_id, literature_id)
);

-- 2. 创建索引：快速查询段落绑定的文献
CREATE INDEX IF NOT EXISTS idx_paragraph_literature_paragraph ON paragraph_literature(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_literature_literature ON paragraph_literature(literature_id);

-- 3. 添加表注释
COMMENT ON TABLE paragraph_literature IS '段落-文献关联表（多对多），支持段落级精准文献引用';
COMMENT ON COLUMN paragraph_literature.id IS '主键ID';
COMMENT ON COLUMN paragraph_literature.paragraph_id IS '段落ID，外键关联 paragraphs 表';
COMMENT ON COLUMN paragraph_literature.literature_id IS '文献ID，外键关联 literature 表';
COMMENT ON COLUMN paragraph_literature.created_at IS '绑定时间';

-- 4. 扩展 literature 表：新增处理模式和分块数量字段
ALTER TABLE literature 
ADD COLUMN IF NOT EXISTS processing_mode VARCHAR(20) NOT NULL DEFAULT 'fast',
ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN literature.processing_mode IS '处理模式：fast=快速模式（仅摘要，3秒），full=完整模式（全文分块，30-60秒）';
COMMENT ON COLUMN literature.chunk_count IS '分块数量：fast模式=1，full模式=N';

-- 5. 更新现有文献记录的处理模式（根据 chunk 数量推断）
UPDATE literature l
SET 
    processing_mode = CASE 
        WHEN (SELECT COUNT(*) FROM literature_chunks WHERE literature_id = l.literature_id) <= 1 
        THEN 'fast' 
        ELSE 'full' 
    END,
    chunk_count = (SELECT COUNT(*) FROM literature_chunks WHERE literature_id = l.literature_id)
WHERE upload_status = 'ready';

-- 6. 验证数据完整性
DO $$
DECLARE
    lit_count INTEGER;
    chunk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO lit_count FROM literature;
    SELECT COUNT(*) INTO chunk_count FROM literature_chunks;
    
    RAISE NOTICE '迁移完成统计：';
    RAISE NOTICE '  - 文献总数: %', lit_count;
    RAISE NOTICE '  - 分块总数: %', chunk_count;
    RAISE NOTICE '  - 段落-文献关联表已创建';
END $$;
