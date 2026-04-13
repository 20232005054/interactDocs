-- 修复 chat_records 外键缺少 ON DELETE CASCADE / SET NULL 的问题
-- 导致删除文档时报 [23503] 外键约束违反错误

-- 1. 修复 document_id 外键：文档删除时级联删除对话记录
ALTER TABLE chat_records
    DROP CONSTRAINT IF EXISTS chat_records_document_id_fkey;

ALTER TABLE chat_records
    ADD CONSTRAINT chat_records_document_id_fkey
    FOREIGN KEY (document_id)
    REFERENCES documents(document_id)
    ON DELETE CASCADE;

-- 2. 修复 chapter_id 外键：章节删除时置空（保留对话记录）
ALTER TABLE chat_records
    DROP CONSTRAINT IF EXISTS chat_records_chapter_id_fkey;

ALTER TABLE chat_records
    ADD CONSTRAINT chat_records_chapter_id_fkey
    FOREIGN KEY (chapter_id)
    REFERENCES chapters(chapter_id)
    ON DELETE SET NULL;
