from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from db.models import DependencyEdge
from uuid import UUID

class DependencyEdgeMapper:
    @staticmethod
    async def create_edge(db: AsyncSession, edge: DependencyEdge):
        db.add(edge)
        await db.commit()
        await db.refresh(edge)
        return edge

    @staticmethod
    async def get_edges_by_target(db: AsyncSession, target_type: str, target_id: UUID):
        result = await db.execute(
            select(DependencyEdge).where(
                DependencyEdge.target_type == target_type,
                DependencyEdge.target_id == target_id
            )
        )
        return result.scalars().all()

    @staticmethod
    async def get_edges_by_source_and_target_type(db: AsyncSession, source_type: str, source_id: UUID, target_type: str = None):
        query = select(DependencyEdge).where(
            DependencyEdge.source_type == source_type,
            DependencyEdge.source_id == source_id
        )
        
        if target_type is not None:
            query = query.where(DependencyEdge.target_type == target_type)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_edge(db: AsyncSession, edge_id: UUID, update_data: dict):
        await db.execute(
            update(DependencyEdge)
            .where(DependencyEdge.edge_id == edge_id)
            .values(**update_data)
        )
        await db.commit()
        # 内联查询逻辑，不再依赖 get_edge_by_id 方法
        result = await db.execute(
            select(DependencyEdge).where(DependencyEdge.edge_id == edge_id)
        )
        return result.scalar_one_or_none()
