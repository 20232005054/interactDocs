from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.models import DependencyEdge
from uuid import UUID

class DependencyService:
    @staticmethod
    async def create_dependency_edge(
        db: AsyncSession,
        source_type: str,
        source_id: UUID,
        target_type: str,
        target_id: UUID,
        document_id: UUID,
        target_version: int = None,
        relevance_score: float = 1.0
    ):
        # 检查是否已存在相同的依赖边
        existing_edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, source_type, source_id, target_type
        )
        
        for edge in existing_edges:
            if edge.target_id == target_id:
                if target_version is not None:
                    await DependencyEdgeMapper.update_edge(db, edge.edge_id, {
                        "target_version": target_version
                    })
                    await db.commit()
                return edge
        
        edge_data = {
            "source_type": source_type,
            "source_id": source_id,
            "target_type": target_type,
            "target_id": target_id,
            "document_id": document_id,
            "relevance_score": relevance_score
        }
        
        if target_version is not None:
            edge_data["target_version"] = target_version
        
        edge = DependencyEdge(**edge_data)
        result = await DependencyEdgeMapper.create_edge(db, edge)
        await db.commit()
        return result
    
    @staticmethod
    async def get_upstream_dependencies(
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID
    ):
        """
        获取上游依赖（当前实体依赖了什么）

        Args:
            entity_type: 实体类型 (paragraph/chapter/summary/core_info)
        """
        # 查找当前实体作为源的依赖边
        # 即：source_type = entity_type, source_id = entity_id
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, entity_type, entity_id, None  # 不限制目标类型
        )
        
        upstream = []
        for edge in edges:
            upstream.append({
                "target_type": edge.target_type,
                "target_id": edge.target_id,
                "edge_id": edge.edge_id,
                "relevance_score": edge.relevance_score,
                "target_version": edge.target_version
            })
        
        return upstream
    
    @staticmethod
    async def get_downstream_dependencies(
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID
    ):
        """
        获取下游依赖（什么依赖了当前实体）

        Args:
            entity_type: 实体类型 (paragraph/chapter/summary/core_info)
        """
        # 查找当前实体作为目标的依赖边
        # 即：target_type = entity_type, target_id = entity_id
        # 需要查询所有可能的源类型
        from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
        
        # 这里需要实现一个新的 mapper 方法来查询所有源类型
        # 暂时使用一个通用查询
        from sqlalchemy import select
        from db.models import DependencyEdge
        
        result = await db.execute(
            select(DependencyEdge)
            .where(
                DependencyEdge.target_type == entity_type,
                DependencyEdge.target_id == entity_id
            )
        )
        edges = result.scalars().all()
        
        downstream = []
        for edge in edges:
            downstream.append({
                "source_type": edge.source_type,
                "source_id": edge.source_id,
                "edge_id": edge.edge_id,
                "relevance_score": edge.relevance_score
            })
        
        return downstream
    
    @staticmethod
    async def get_dependencies(
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID
    ):
        """同时获取上下游依赖，entity_type 支持 paragraph/chapter/summary/core_info"""
        # 并行获取上下游依赖
        upstream = await DependencyService.get_upstream_dependencies(
            db, entity_type, entity_id
        )
        
        downstream = await DependencyService.get_downstream_dependencies(
            db, entity_type, entity_id
        )
        
        return {
            "upstream": upstream,
            "downstream": downstream
        }
