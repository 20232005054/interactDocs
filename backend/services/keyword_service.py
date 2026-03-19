from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.keyword_mapper import KeywordMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.models import DocumentKeyword, DocumentKeywordHistory
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
        
        # 检查是否有实质性变更
        from services.ai_service import is_substantial_change
        is_change = await is_substantial_change(
            old_keyword.keyword, 
            keyword_in.keyword
        )
        
        # 准备更新数据
        update_data = {
            "keyword": keyword_in.keyword,
            "version": old_keyword.version + 1
        }
        
        if is_change:
            updated_keyword = await KeywordMapper.update_keyword(db, keyword_id, update_data)
            # 处理关联的摘要和段落更新
            await KeywordService._handle_keyword_change(db, old_keyword, updated_keyword)
            return updated_keyword
        
        # 创建历史记录
        history = DocumentKeywordHistory(
            keyword_id=keyword_id,
            version=old_keyword.version,
            keyword=old_keyword.keyword
        )
        db.add(history)
        
        # 直接更新关键词
        updated_keyword = await KeywordMapper.update_keyword(db, keyword_id, update_data)  
        return updated_keyword

    @staticmethod
    async def delete_keyword(db: AsyncSession, keyword_id: UUID):
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if keyword:
            await KeywordMapper.delete_keyword(db, keyword)
            return {"message": "删除成功"}
        return {"message": "关键词不存在"}

    @staticmethod
    async def _handle_keyword_change(db: AsyncSession, old_keyword: DocumentKeyword, updated_keyword: DocumentKeyword):
        """
        处理关键词变更时对关联的摘要和段落的影响
        """
        # 获取与旧关键词关联的所有依赖边
        old_edges = await DependencyEdgeMapper.get_edges_by_target(
            db, "keyword", old_keyword.keyword_id
        )
        
        # 对于每个关联，更新 is_change 为 1
        for edge in old_edges:
            if edge.source_type == "summary":
                from db.mappers.summary_mapper import SummaryMapper
                summary = await SummaryMapper.get_summary_by_id(db, edge.source_id)
                if summary:
                    # 更新摘要的 is_change 为 1
                    await SummaryMapper.update_summary(db, summary.summary_id, {"is_change": 1})
            elif edge.source_type == "paragraph":
                from db.mappers.paragraph_mapper import ParagraphMapper
                paragraph = await ParagraphMapper.get_paragraph_by_id(db, edge.source_id)
                if paragraph:
                    # 更新段落的 ischange 为 1
                    await ParagraphMapper.update_paragraph(db, paragraph.paragraph_id, {"ischange": 1})

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
    