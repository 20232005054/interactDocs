from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 格式: postgresql+asyncpg://用户名:密码@地址:端口/数据库名
DATABASE_URL = "postgresql+asyncpg://postgres:123456@192.168.104.44:5432/agent01"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session