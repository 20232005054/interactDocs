from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.keyword_mapper import KeywordMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.models import DocumentKeyword, DependencyEdge
from schemas.schemas import  DocumentKeywordUpdate
from uuid import UUID

class KeywordService:
    @staticmethod
    async def create_keyword(db: AsyncSession, keyword_in: DocumentKeywordUpdate, document_id: UUID):
        new_keyword = DocumentKeyword(
            document_id=document_id,
            keyword=keyword_in.keyword
        )
        return await KeywordMapper.create_keyword(db, new_keyword)

    @staticmethod
    async def get_keyword_by_id(db: AsyncSession, keyword_id: UUID):
        return await KeywordMapper.get_keyword_by_id(db, keyword_id)

    @staticmethod
    async def get_keywords_by_document_id(db: AsyncSession, document_id: UUID):
        return await KeywordMapper.get_keywords_by_document_id(db, document_id)

    @staticmethod
    async def update_keyword(db: AsyncSession, keyword_id: UUID, keyword_in: DocumentKeywordUpdate):
        # 获取旧关键词
        old_keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if not old_keyword:
            return None
        
        """
                # 检查是否有实质性变更
        is_substantial_change = await KeywordService._is_substantial_change(
            old_keyword.keyword, 
            keyword_in.keyword
        )
        
        if is_substantial_change:
            # 创建历史记录
            from db.models import DocumentKeywordHistory
            history = DocumentKeywordHistory(
                keyword_id=keyword_id,
                version=old_keyword.version,
                keyword=old_keyword.keyword
            )
            await db.add(history)
            
            # 更新关键词
            update_data = {
                "keyword": keyword_in.keyword,
                "version": old_keyword.version + 1
            }
            updated_keyword = await KeywordMapper.update_keyword(db, keyword_id, update_data)
            
            # 处理关联的摘要和段落更新
            await KeywordService._handle_keyword_change(db, old_keyword, updated_keyword)
            return updated_keyword
        else:
            # 不需要更新
            return old_keyword
        """

        # 直接创建历史记录
        from db.models import DocumentKeywordHistory
        history = DocumentKeywordHistory(
            keyword_id=keyword_id,
            version=old_keyword.version,
            keyword=old_keyword.keyword
        )
        db.add(history)
        
        # 直接更新关键词
        update_data = {
            "keyword": keyword_in.keyword,
            "version": old_keyword.version + 1
        }
        updated_keyword = await KeywordMapper.update_keyword(db, keyword_id, update_data)
        
        # 注释掉关联的摘要和段落更新处理
        # await KeywordService._handle_keyword_change(db, old_keyword, updated_keyword)
        
        return updated_keyword

    @staticmethod
    async def delete_keyword(db: AsyncSession, keyword_id: UUID):
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if keyword:
            await KeywordMapper.delete_keyword(db, keyword)
            return {"message": "删除成功"}
        return {"message": "关键词不存在"}

    @staticmethod
    async def create_keyword_summary_link(db: AsyncSession, keyword_id: UUID, summary_id: UUID):
        # 检查是否已存在相同的依赖边
        existing_edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, "summary", summary_id, "keyword"
        )
        
        # 如果已存在关联，更新它
        for edge in existing_edges:
            if edge.target_id == keyword_id:
                return edge
        
        # 创建新的依赖边
        edge = DependencyEdge(
            source_type="summary",
            source_id=summary_id,
            target_type="keyword",
            target_id=keyword_id,
            relevance_score=1.0
        )
        
        return await DependencyEdgeMapper.create_edge(db, edge)

    @staticmethod
    async def create_keyword_paragraph_link(db: AsyncSession, keyword_id: UUID, paragraph_id: UUID):
        # 获取关键词信息，包括版本
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if not keyword:
            return None
        
        # 检查是否已存在相同的依赖边
        existing_edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, "paragraph", paragraph_id, "keyword"
        )
        
        # 如果已存在关联，更新它
        for edge in existing_edges:
            if edge.target_id == keyword_id:
                await DependencyEdgeMapper.update_edge(db, edge.edge_id, {
                    "target_version": keyword.version
                })
                return edge
        
        # 创建新的依赖边
        edge = DependencyEdge(
            source_type="paragraph",
            source_id=paragraph_id,
            target_type="keyword",
            target_id=keyword_id,
            target_version=keyword.version,
            relevance_score=1.0
        )
        
        return await DependencyEdgeMapper.create_edge(db, edge)

    @staticmethod
    async def get_summary_related_keywords(db: AsyncSession, summary_id: UUID):
        """
        获取摘要关联的关键词信息
        """
        # 获取与摘要关联的关键词（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, "summary", summary_id, "keyword"
        )
        
        related_keywords = []
        for edge in edges:
            keyword = await KeywordMapper.get_keyword_by_id(db, edge.target_id)
            if keyword:
                related_keywords.append({
                    "keyword_id": keyword.keyword_id,
                    "document_id": keyword.document_id,
                    "keyword": keyword.keyword,
                    "created_at": keyword.created_at,
                    "updated_at": keyword.updated_at,
                    "relevance_score": edge.relevance_score
                })
        
        return related_keywords

    @staticmethod
    async def get_paragraph_related_keywords(db: AsyncSession, paragraph_id: UUID):
        """
        获取段落关联的关键词信息
        """
        # 获取与段落关联的关键词（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, "paragraph", paragraph_id, "keyword"
        )
        
        related_keywords = []
        for edge in edges:
            keyword = await KeywordMapper.get_keyword_by_id(db, edge.target_id)
            if keyword:
                related_keywords.append({
                    "keyword_id": keyword.keyword_id,
                    "document_id": keyword.document_id,
                    "keyword": keyword.keyword,
                    "created_at": keyword.created_at,
                    "updated_at": keyword.updated_at,
                    "relevance_score": edge.relevance_score
                })
        
        return related_keywords


