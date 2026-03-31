from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from db.models import DocumentCoreInfo
import uuid

class CoreInfoMapper:
    @staticmethod
    async def create_core_info(db: AsyncSession, core_info: DocumentCoreInfo) -> DocumentCoreInfo:
        db.add(core_info)
        await db.commit()
        await db.refresh(core_info)
        return core_info
    
    @staticmethod
    async def get_core_info_by_id(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        result = await db.execute(
            select(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_core_info_by_document_id(db: AsyncSession, document_id: uuid.UUID) -> list[DocumentCoreInfo]:
        result = await db.execute(
            select(DocumentCoreInfo)
            .where(DocumentCoreInfo.document_id == document_id)
            .order_by(DocumentCoreInfo.order_index)
        )
        return result.scalars().all()
    
    @staticmethod
    async def update_core_info(db: AsyncSession, core_info_id: uuid.UUID, update_data: dict) -> DocumentCoreInfo:
        await db.execute(
            update(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
            .values(**update_data)
        )
        await db.commit()
        return await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
    
    @staticmethod
    async def delete_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> bool:
        # 获取要删除的记录
        target = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
        if not target:
            return False
            
        document_id = target.document_id
        deleted_order_index = target.order_index
        parent_id = target.parent_id

        result = await db.execute(
            delete(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
        )
        
        # 严格维护：将被删记录之后的所有记录的 order_index 减 1
        if result.rowcount > 0:
            query = update(DocumentCoreInfo).where(
                DocumentCoreInfo.document_id == document_id,
                DocumentCoreInfo.order_index > deleted_order_index
            )
            if parent_id:
                query = query.where(DocumentCoreInfo.parent_id == parent_id)
            else:
                query = query.where(DocumentCoreInfo.parent_id.is_(None))
                
            await db.execute(query.values(order_index=DocumentCoreInfo.order_index - 1))
            
        await db.commit()
        return result.rowcount > 0
    
    @staticmethod
    async def update_order_index(db: AsyncSession, document_id: uuid.UUID, core_info_id: uuid.UUID, new_order: int) -> bool:
        # 1. 获取当前目标记录
        target = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
        if not target:
            return False
            
        old_order = target.order_index
        if old_order == new_order:
            return True # 没有变化

        parent_id = target.parent_id

        # 2. 区分是向前移还是向后移
        if new_order < old_order:
            # 向前移动：新位置到老位置之间的所有元素（不含老位置，含新位置），order_index + 1
            query = update(DocumentCoreInfo).where(
                DocumentCoreInfo.document_id == document_id,
                DocumentCoreInfo.order_index >= new_order,
                DocumentCoreInfo.order_index < old_order
            )
            if parent_id:
                query = query.where(DocumentCoreInfo.parent_id == parent_id)
            else:
                query = query.where(DocumentCoreInfo.parent_id.is_(None))
                
            await db.execute(query.values(order_index=DocumentCoreInfo.order_index + 1))
        else:
            # 向后移动：老位置到新位置之间的所有元素（不含老位置，含新位置），order_index - 1
            query = update(DocumentCoreInfo).where(
                DocumentCoreInfo.document_id == document_id,
                DocumentCoreInfo.order_index > old_order,
                DocumentCoreInfo.order_index <= new_order
            )
            if parent_id:
                query = query.where(DocumentCoreInfo.parent_id == parent_id)
            else:
                query = query.where(DocumentCoreInfo.parent_id.is_(None))
                
            await db.execute(query.values(order_index=DocumentCoreInfo.order_index - 1))

        # 3. 再更新目标记录到新位置
        result = await db.execute(
            update(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
            .values(order_index=new_order)
        )
        await db.commit()
        return result.rowcount > 0
