-- 为文档8904a0be-91f7-4a17-8a87-583ce06c26c1插入摘要数据

-- 插入试验名称摘要
INSERT INTO document_summaries (summary_id, document_id, title, content, version, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '8904a0be-91f7-4a17-8a87-583ce06c26c1',
    '试验名称',
    '评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 插入试验目的摘要
INSERT INTO document_summaries (summary_id, document_id, title, content, version, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '8904a0be-91f7-4a17-8a87-583ce06c26c1',
    '试验目的',
    '验证试验器械用于改善肩颈部或腰部疼痛的有效性和安全性。',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 插入研究设计摘要
INSERT INTO document_summaries (summary_id, document_id, title, content, version, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '8904a0be-91f7-4a17-8a87-583ce06c26c1',
    '研究设计',
    '前瞻性、多中心、随机、平行、安慰剂对照、盲法、优效性设计。',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 插入试验组摘要
INSERT INTO document_summaries (summary_id, document_id, title, content, version, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '8904a0be-91f7-4a17-8a87-583ce06c26c1',
    '试验组',
    '试验器械：高频治疗仪，型号规格：EW-RA550K492、EW-RA550H492、EW-RA550WK492',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 插入对照组摘要
INSERT INTO document_summaries (summary_id, document_id, title, content, version, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '8904a0be-91f7-4a17-8a87-583ce06c26c1',
    '对照组',
    '伪治疗（使用无效器械进行治疗）',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);