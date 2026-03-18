from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import OperationHistory
from uuid import UUID

class OperationHistoryMapper:
    @staticmethod
    async def get_operation_history(db: AsyncSession, page: int = 1, page_size: int = 10):
        """
        获取操作历史记录（分页）
        """
        # 查询操作历史总数
        count_result = await db.execute(select(OperationHistory))
        total = len(count_result.scalars().all())
        
        # 分页查询操作历史
        offset = (page - 1) * page_size
        result = await db.execute(
            select(OperationHistory)
            .order_by(OperationHistory.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        history = result.scalars().all()
        
        return total, history
    
    @staticmethod
    async def create_operation_history(db: AsyncSession, history):
        """
        创建操作历史记录
        """
        db.add(history)
        await db.commit()
        await db.refresh(history)
        return history