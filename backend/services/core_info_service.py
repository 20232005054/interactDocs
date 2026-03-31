from sqlalchemy.ext.asyncio import AsyncSession
from db.models import DocumentCoreInfo
from db.mappers.core_info_mapper import CoreInfoMapper
from schemas.schemas import CoreInfoCreate, CoreInfoUpdate
import uuid
from sqlalchemy import select, func

class CoreInfoService:
    @staticmethod
    async def create_core_info(db: AsyncSession, document_id: uuid.UUID, core_info_in: CoreInfoCreate) -> DocumentCoreInfo:
        # 校验 parent_id 是否属于该文档
        if core_info_in.parent_id:
            parent_node = await CoreInfoMapper.get_core_info_by_id(db, core_info_in.parent_id)
            if not parent_node or parent_node.document_id != document_id:
                raise ValueError("父节点不存在或不属于当前文档")

        # 计算 order_index
        if core_info_in.order_index is None:
            # 获取同级节点最大 order_index
            query = select(func.count(DocumentCoreInfo.core_info_id)).where(DocumentCoreInfo.document_id == document_id)
            if core_info_in.parent_id:
                query = query.where(DocumentCoreInfo.parent_id == core_info_in.parent_id)
            else:
                query = query.where(DocumentCoreInfo.parent_id.is_(None))
                
            result = await db.execute(query)
            order_index = result.scalar() or 0
        else:
            order_index = core_info_in.order_index
        
        core_info = DocumentCoreInfo(
            document_id=document_id,
            parent_id=core_info_in.parent_id,
            title=core_info_in.title,
            content=core_info_in.content,
            field_type=core_info_in.field_type,
            options=core_info_in.options,
            is_required=core_info_in.is_required,
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
    async def get_core_info_tree(db: AsyncSession, document_id: uuid.UUID) -> list[dict]:
        core_infos = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        
        info_dict_map = {}
        for info in core_infos:
            info_dict_map[info.core_info_id] = {
                "core_info_id": info.core_info_id,
                "document_id": info.document_id,
                "parent_id": info.parent_id,
                "title": info.title,
                "content": info.content,
                "field_type": info.field_type,
                "options": info.options,
                "is_required": info.is_required,
                "order_index": info.order_index,
                "is_locked": info.is_locked,
                "is_change": info.is_change,
                "created_at": info.created_at,
                "updated_at": info.updated_at,
                "children": []
            }
            
        tree = []
        for info in core_infos:
            node = info_dict_map[info.core_info_id]
            if info.parent_id and info.parent_id in info_dict_map:
                info_dict_map[info.parent_id]["children"].append(node)
            else:
                tree.append(node)
                
        def sort_tree(nodes):
            nodes.sort(key=lambda x: x["order_index"])
            for n in nodes:
                if n["children"]:
                    sort_tree(n["children"])
                    
        sort_tree(tree)
        return tree
    
    @staticmethod
    async def update_core_info(db: AsyncSession, core_info_id: uuid.UUID, core_info_in: CoreInfoUpdate) -> DocumentCoreInfo:
        update_data = core_info_in.model_dump(exclude_unset=True)
        # 移除不可直接更新或需要特殊处理的字段
        if "children" in update_data:
            del update_data["children"]
            
        if "parent_id" in update_data and update_data["parent_id"] is not None:
            # 校验 parent_id
            existing = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
            if existing:
                parent_node = await CoreInfoMapper.get_core_info_by_id(db, update_data["parent_id"])
                if not parent_node or parent_node.document_id != existing.document_id:
                    raise ValueError("父节点不存在或不属于当前文档")
                # 防环校验
                if str(update_data["parent_id"]) == str(core_info_id):
                    raise ValueError("父节点不能是自己")

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
