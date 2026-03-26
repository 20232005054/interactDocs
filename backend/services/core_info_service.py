from sqlalchemy.ext.asyncio import AsyncSession
from db.models import DocumentCoreInfo
from db.mappers.core_info_mapper import CoreInfoMapper
from schemas.schemas import CoreInfoCreate, CoreInfoUpdate
import uuid
from sqlalchemy import select, func

class CoreInfoService:
    @staticmethod
    async def create_core_info(db: AsyncSession, core_info_in: CoreInfoCreate) -> DocumentCoreInfo:
        # 计算 order_index
        if core_info_in.order_index is None:
            result = await db.execute(
                select(func.count(DocumentCoreInfo.core_info_id))
                .where(DocumentCoreInfo.document_id == core_info_in.document_id)
            )
            order_index = result.scalar() or 0
        else:
            order_index = core_info_in.order_index
        
        core_info = DocumentCoreInfo(
            document_id=core_info_in.document_id,
            title=core_info_in.title,
            content=core_info_in.content,
            order_index=order_index,
            is_locked=core_info_in.is_locked
        )
        
        return await CoreInfoMapper.create_core_info(db, core_info)
    
    @staticmethod
    async def get_core_info_by_id(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        return await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
    
    @staticmethod
    async def get_core_info_by_document_id(db: AsyncSession, document_id: uuid.UUID) -> list[DocumentCoreInfo]:
        return await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
    
    @staticmethod
    async def update_core_info(db: AsyncSession, core_info_id: uuid.UUID, core_info_in: CoreInfoUpdate) -> DocumentCoreInfo:
        update_data = core_info_in.model_dump(exclude_unset=True)
        return await CoreInfoMapper.update_core_info(db, core_info_id, update_data)
    
    @staticmethod
    async def delete_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> bool:
        return await CoreInfoMapper.delete_core_info(db, core_info_id)
    
    @staticmethod
    async def update_order(db: AsyncSession, document_id: uuid.UUID, core_info_id: uuid.UUID, new_order: int) -> bool:
        return await CoreInfoMapper.update_order_index(db, document_id, core_info_id, new_order)
    
    @staticmethod
    async def lock_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        return await CoreInfoMapper.update_core_info(db, core_info_id, {"is_locked": True})
    
    @staticmethod
    async def unlock_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        return await CoreInfoMapper.update_core_info(db, core_info_id, {"is_locked": False})
