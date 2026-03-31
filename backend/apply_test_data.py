import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:123456@192.168.104.48:5432/agent02"

async def main():
    engine = create_async_engine(DATABASE_URL)
    with open("sql/insert_template_test_data.sql", "r", encoding="utf-8") as f:
        sql = f.read()
    
    async with engine.begin() as conn:
        # Before inserting, we might want to clean up existing data for this template
        # to avoid conflict, but since we use the same UUIDs it might violate unique constraints
        # Let's clean up old core_info_templates for this template_id
        await conn.execute(text("DELETE FROM core_info_templates WHERE template_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'"))
        
        # Then execute the insert script
        # The script contains multiple statements, let's split them or execute them one by one if possible
        # Actually asyncpg can execute multiple statements at once if we don't use parameter binding.
        await conn.execute(text(sql))
        print("Test data inserted successfully.")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())