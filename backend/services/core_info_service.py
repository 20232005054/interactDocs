from sqlalchemy.ext.asyncio import AsyncSession
from db.models import DocumentCoreInfo
from db.mappers.core_info_mapper import CoreInfoMapper
from schemas.schemas import CoreInfoCreate, CoreInfoUpdate
import uuid
from sqlalchemy import select, func, update

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
            query = select(func.max(DocumentCoreInfo.order_index)).where(DocumentCoreInfo.document_id == document_id)
            if core_info_in.parent_id:
                query = query.where(DocumentCoreInfo.parent_id == core_info_in.parent_id)
            else:
                query = query.where(DocumentCoreInfo.parent_id.is_(None))
                
            result = await db.execute(query)
            max_val = result.scalar()
            order_index = (max_val + 1) if max_val is not None else 0
        else:
            # 传入指定位置时，将该位置及之后的同级节点后移
            shift_query = update(DocumentCoreInfo).where(
                DocumentCoreInfo.document_id == document_id,
                DocumentCoreInfo.order_index >= core_info_in.order_index
            )
            if core_info_in.parent_id:
                shift_query = shift_query.where(DocumentCoreInfo.parent_id == core_info_in.parent_id)
            else:
                shift_query = shift_query.where(DocumentCoreInfo.parent_id.is_(None))
            await db.execute(shift_query.values(order_index=DocumentCoreInfo.order_index + 1))
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
        
        result = await CoreInfoMapper.create_core_info(db, core_info)
        await db.commit()
        return result
    
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
        if "children" in update_data:
            del update_data["children"]
            
        if "parent_id" in update_data and update_data["parent_id"] is not None:
            existing = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
            if existing:
                parent_node = await CoreInfoMapper.get_core_info_by_id(db, update_data["parent_id"])
                if not parent_node or parent_node.document_id != existing.document_id:
                    raise ValueError("父节点不存在或不属于当前文档")
                if str(update_data["parent_id"]) == str(core_info_id):
                    raise ValueError("父节点不能是自己")

        # 记录旧内容，用于后台变更判断
        old_node = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
        old_content = old_node.content if old_node else ""
        new_content = update_data.get("content", old_content)

        # 如果内容有变化，乐观标记 is_change=1
        if "content" in update_data and new_content != old_content:
            update_data["is_change"] = 1

        updated = await CoreInfoMapper.update_core_info(db, core_info_id, update_data)
        await db.commit()

        # 启动后台任务处理下游联动
        if "content" in update_data and new_content != old_content:
            import asyncio
            from services.core_info_change_service import handle_core_info_change_async
            from core.utils import log_task_exception
            task = asyncio.create_task(
                handle_core_info_change_async(core_info_id, old_content, new_content),
                name=f"core_info_change_{core_info_id}",
            )
            task.add_done_callback(log_task_exception)

        return updated
    
    @staticmethod
    async def delete_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> bool:
        result = await CoreInfoMapper.delete_core_info(db, core_info_id)
        await db.commit()
        return result
    
    @staticmethod
    async def update_order(db: AsyncSession, document_id: uuid.UUID, core_info_id: uuid.UUID, new_order: int) -> bool:
        result = await CoreInfoMapper.update_order_index(db, document_id, core_info_id, new_order)
        await db.commit()
        return result
    
    @staticmethod
    async def lock_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        result = await CoreInfoMapper.update_core_info(db, core_info_id, {"is_locked": True})
        await db.commit()
        return result
    
    @staticmethod
    async def unlock_core_info(db: AsyncSession, core_info_id: uuid.UUID) -> DocumentCoreInfo:
        result = await CoreInfoMapper.update_core_info(db, core_info_id, {"is_locked": False})
        await db.commit()
        return result

    @staticmethod
    async def reorder(db: AsyncSession, document_id: uuid.UUID, parent_id, ordered_ids: list) -> None:
        """
        批量重排：传入同级节点新顺序 ID 列表，按下标重写 order_index。
        支持跨父节点移动：若节点原 parent_id 与传入 parent_id 不同，同时更新 parent_id。
        """
        from sqlalchemy import update as sa_update

        # 前置验证 parent_id 存在性
        if parent_id is not None:
            parent_node = await CoreInfoMapper.get_core_info_by_id(db, parent_id)
            if not parent_node or parent_node.document_id != document_id:
                raise ValueError(f"父节点 {parent_id} 不存在或不属于当前文档")

        for idx, cid in enumerate(ordered_ids):
            node = await CoreInfoMapper.get_core_info_by_id(db, cid)
            if not node:
                raise ValueError(f"节点 {cid} 不存在")
            values = {"order_index": idx}
            if node.parent_id != parent_id:
                values["parent_id"] = parent_id
            await db.execute(
                sa_update(DocumentCoreInfo)
                .where(DocumentCoreInfo.core_info_id == cid)
                .values(**values)
            )
        await db.commit()
