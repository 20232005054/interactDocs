-- 将 dependency_edges 表中 target_type = 'document_entity' 的记录更新为 'core_info'
UPDATE dependency_edges SET target_type = 'core_info' WHERE target_type = 'document_entity';
