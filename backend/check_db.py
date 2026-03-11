import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# 数据库连接字符串
DATABASE_URL = "postgresql+asyncpg://postgres:123456@localhost:5432/agent01"

async def check_table_structure():
    # 创建异步引擎
    engine = create_async_engine(DATABASE_URL)
    
    # 创建会话
    async with engine.connect() as conn:
        # 检查 chapters 表结构
        print("检查 chapters 表结构:")
        result = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chapters'"))
        rows = result.all()
        for row in rows:
            print(f"字段: {row.column_name}, 类型: {row.data_type}")
    
    # 关闭引擎
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_table_structure())
