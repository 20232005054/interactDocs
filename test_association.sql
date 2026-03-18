-- 创建测试数据

-- 1. 创建文档
INSERT INTO documents (document_id, title, purpose, created_at, updated_at) 
VALUES 
('550e8400-e29b-41d4-a716-446655440000', '测试文档', '临床研究', NOW(), NOW());

-- 2. 创建摘要A（研究背景）
INSERT INTO document_summaries (summary_id, document_id, title, content, version, order_index, created_at, updated_at) 
VALUES 
('6ba7b810-9dad-11d1-80b4-00c04fd430c8', '550e8400-e29b-41d4-a716-446655440000', '研究背景', '本研究旨在探索新的治疗方法，针对现有治疗方案的局限性进行改进。', 1, 0, NOW(), NOW());

-- 3. 创建章节
INSERT INTO chapters (chapter_id, document_id, title, status, order_index, created_at, updated_at) 
VALUES 
('88888888-8888-4444-8888-888888888888', '550e8400-e29b-41d4-a716-446655440000', '研究背景', 0, 0, NOW(), NOW());

-- 4. 创建段落A（研究背景的具体展开）
INSERT INTO paragraphs (paragraph_id, chapter_id, content, para_type, order_index, ischange, created_at, updated_at) 
VALUES 
('99999999-9999-4444-9999-999999999999', '88888888-8888-4444-8888-888888888888', '目前，针对该疾病的治疗方法主要包括药物治疗和手术治疗。药物治疗存在副作用大、效果有限的问题；手术治疗则存在风险高、恢复周期长的缺点。本研究将探索一种新的治疗方案，结合两者的优势，减少副作用和风险。', 'paragraph', 0, 0, NOW(), NOW());

-- 5. 建立段落与摘要的关联
INSERT INTO dependency_edges (edge_id, source_type, source_id, target_type, target_id, target_version, relevance_score, created_at, updated_at) 
VALUES 
('aaaaaaaa-aaaa-4444-aaaa-aaaaaaaaaaaa', 'paragraph', '99999999-9999-4444-9999-999999999999', 'summary', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', 1, 1.0, NOW(), NOW());

-- 测试命令

-- 测试场景1：更新段落A的内容，查看摘要A的状态
-- 更新段落A，添加新的研究背景方向
UPDATE paragraphs 
SET content = '目前，针对该疾病的治疗方法主要包括药物治疗和手术治疗。药物治疗存在副作用大、效果有限的问题；手术治疗则存在风险高、恢复周期长的缺点。本研究将探索一种新的治疗方案，结合两者的优势，减少副作用和风险。此外，本研究还将关注患者的生活质量，探索如何在治疗过程中提高患者的生活质量。', 
    updated_at = NOW() 
WHERE paragraph_id = '99999999-9999-4444-9999-999999999999';

-- 查看摘要A的is_change状态
SELECT summary_id, title, is_change FROM document_summaries WHERE summary_id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

-- 测试场景2：更新摘要A的内容，查看段落A的状态
-- 更新摘要A，添加新的展开方向
UPDATE document_summaries 
SET content = '本研究旨在探索新的治疗方法，针对现有治疗方案的局限性进行改进。同时，本研究将关注患者的生活质量，探索如何在治疗过程中提高患者的生活质量。', 
    version = version + 1, 
    updated_at = NOW() 
WHERE summary_id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

-- 查看段落A的is_change状态
SELECT paragraph_id, ischange FROM paragraphs WHERE paragraph_id = '99999999-9999-4444-9999-999999999999';

-- 查看依赖边的target_version是否更新
SELECT edge_id, target_version FROM dependency_edges WHERE source_id = '99999999-9999-4444-9999-999999999999';

-- 清理测试数据
-- DELETE FROM dependency_edges WHERE source_id = '99999999-9999-4444-9999-999999999999';
-- DELETE FROM paragraphs WHERE paragraph_id = '99999999-9999-4444-9999-999999999999';
-- DELETE FROM chapters WHERE chapter_id = '88888888-8888-4444-8888-888888888888';
-- DELETE FROM document_summaries WHERE summary_id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
-- DELETE FROM documents WHERE document_id = '550e8400-e29b-41d4-a716-446655440000';
