# 测试数据库连接脚本
import asyncio
import asyncpg

async def test_db_connection():
    try:
        conn = await asyncpg.connect(
            user="postgres",
            password="123456",
            database="agent",
            host="localhost",  # 或数据库地址
            port=5432
        )
        print("数据库连接成功！")
        await conn.close()
    except Exception as e:
        print(f"连接失败: {e}")

asyncio.run(test_db_connection())