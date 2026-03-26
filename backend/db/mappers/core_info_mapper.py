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
        result = await db.execute(
            delete(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
        )
        await db.commit()
        return result.rowcount > 0
    
    @staticmethod
    async def update_order_index(db: AsyncSession, document_id: uuid.UUID, core_info_id: uuid.UUID, new_order: int) -> bool:
        # 先更新其他记录的order_index
        await db.execute(
            update(DocumentCoreInfo)
            .where(
                DocumentCoreInfo.document_id == document_id,
                DocumentCoreInfo.order_index >= new_order,
                DocumentCoreInfo.core_info_id != core_info_id
            )
            .values(order_index=DocumentCoreInfo.order_index + 1)
        )
        # 再更新目标记录
        result = await db.execute(
            update(DocumentCoreInfo)
            .where(DocumentCoreInfo.core_info_id == core_info_id)
            .values(order_index=new_order)
        )
        await db.commit()
        return result.rowcount > 0
