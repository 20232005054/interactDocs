"""
清理重复的文献记录（基于 DOI）

运行方式：
cd backend
python -m scripts.clean_duplicate_literature
"""

import asyncio
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import AsyncSessionLocal
from db.models import Literature


async def clean_duplicate_literature():
    """
    清理重复的文献记录：
    1. 找出所有有 DOI 的文献
    2. 按 DOI 分组，保留最早创建的，删除其他的
    """
    async with AsyncSessionLocal() as db:
        # 1. 查询所有有 DOI 的文献
        result = await db.execute(
            select(Literature)
            .where(Literature.doi.isnot(None))
            .order_by(Literature.doi, Literature.created_at.asc())
        )
        all_lit = result.scalars().all()
        
        print(f"总共找到 {len(all_lit)} 篇有 DOI 的文献")
        
        # 2. 按 DOI 分组
        doi_groups: dict[str, list[Literature]] = {}
        for lit in all_lit:
            if lit.doi not in doi_groups:
                doi_groups[lit.doi] = []
            doi_groups[lit.doi].append(lit)
        
        # 3. 找出重复的 DOI
        duplicates = {doi: lits for doi, lits in doi_groups.items() if len(lits) > 1}
        
        if not duplicates:
            print("✅ 没有发现重复的文献")
            return
        
        print(f"\n⚠️ 发现 {len(duplicates)} 个重复的 DOI：")
        
        total_deleted = 0
        for doi, lits in duplicates.items():
            print(f"\nDOI: {doi}")
            print(f"  共 {len(lits)} 条记录：")
            
            # 保留最早的，删除其他的
            keep = lits[0]
            to_delete = lits[1:]
            
            print(f"  ✓ 保留: {keep.literature_id} (创建于 {keep.created_at})")
            for lit in to_delete:
                print(f"  ✗ 删除: {lit.literature_id} (创建于 {lit.created_at})")
                await db.execute(
                    delete(Literature).where(Literature.literature_id == lit.literature_id)
                )
                total_deleted += 1
        
        await db.commit()
        print(f"\n✅ 清理完成，共删除 {total_deleted} 条重复记录")


if __name__ == "__main__":
    asyncio.run(clean_duplicate_literature())
