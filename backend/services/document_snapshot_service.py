from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete
from db.mappers.document_mapper import DocumentMapper
from db.models import Chapter, Paragraph, DocumentCoreInfo, DocumentSummary, DocumentVersion
from uuid import UUID
from fastapi import HTTPException


class DocumentSnapshotService:

    @staticmethod
    async def get_document_snapshots(db: AsyncSession, document_id: UUID):
        """获取文档快照列表"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        snapshots = await DocumentMapper.get_snapshots_by_document_id(db, document_id)

        snapshot_list = []
        for snapshot in snapshots:
            snapshot_list.append({
                "version_id": snapshot.version_id,
                "document_id": snapshot.document_id,
                "description": snapshot.description,
                "snapshot_data": snapshot.snapshot_data,
                "created_at": snapshot.created_at,
                "created_by": snapshot.created_by
            })

        return snapshot_list

    @staticmethod
    async def get_snapshot_detail(db: AsyncSession, document_id: UUID, snapshot_id: UUID):
        """获取快照详情"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        snapshot = await DocumentMapper.get_snapshot_by_id(db, snapshot_id, document_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")

        if "chapters" in snapshot.snapshot_data:
            for chapter in snapshot.snapshot_data["chapters"]:
                if "paragraphs" not in chapter:
                    chapter["paragraphs"] = []

        return {
            "version_id": snapshot.version_id,
            "document_id": snapshot.document_id,
            "description": snapshot.description,
            "snapshot_data": snapshot.snapshot_data,
            "created_at": snapshot.created_at,
            "created_by": snapshot.created_by
        }

    @staticmethod
    async def create_document_snapshot(db: AsyncSession, document_id: UUID):
        """创建文档快照（全量：章节+段落+摘要+核心信息），最多保留 20 个"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        MAX_SNAPSHOTS = 20
        existing = await DocumentMapper.get_snapshots_by_document_id(db, document_id)
        if len(existing) >= MAX_SNAPSHOTS:
            oldest = existing[0]
            await db.delete(oldest)

        document.snapshot_cursor += 1
        description = f"快照{document.snapshot_cursor}"

        # 章节 + 段落
        chapters_result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id).order_by(Chapter.order_index)
        )
        chapters = chapters_result.scalars().all()

        chapters_data = []
        for chapter in chapters:
            paragraphs_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = paragraphs_result.scalars().all()
            chapters_data.append({
                "chapter_id": str(chapter.chapter_id),
                "parent_id": str(chapter.parent_id) if chapter.parent_id else None,
                "title": chapter.title,
                "field_key": chapter.field_key,
                "status": chapter.status,
                "order_index": chapter.order_index,
                "paragraphs": [
                    {
                        "paragraph_id": str(para.paragraph_id),
                        "content": para.content,
                        "para_type": para.para_type,
                        "order_index": para.order_index,
                        "ai_eval": para.ai_eval,
                        "ai_suggestion": para.ai_suggestion,
                        "ai_generate": para.ai_generate,
                        "ischange": para.ischange,
                    }
                    for para in paragraphs
                ],
            })

        # 摘要
        summaries_result = await db.execute(
            select(DocumentSummary).where(DocumentSummary.document_id == document_id).order_by(DocumentSummary.order_index)
        )
        summaries = summaries_result.scalars().all()
        summaries_data = [
            {
                "summary_id": str(s.summary_id),
                "title": s.title,
                "field_key": s.field_key,
                "content": s.content,
                "version": s.version,
                "is_change": s.is_change,
                "order_index": s.order_index,
            }
            for s in summaries
        ]

        # 核心信息
        core_info_result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id).order_by(DocumentCoreInfo.order_index)
        )
        core_infos = core_info_result.scalars().all()
        core_info_data = [
            {
                "core_info_id": str(ci.core_info_id),
                "parent_id": str(ci.parent_id) if ci.parent_id else None,
                "title": ci.title,
                "field_key": ci.field_key,
                "content": ci.content,
                "field_type": ci.field_type,
                "options": ci.options,
                "is_required": ci.is_required,
                "order_index": ci.order_index,
                "is_locked": ci.is_locked,
            }
            for ci in core_infos
        ]

        snapshot_data = {
            "chapters": chapters_data,
            "summaries": summaries_data,
            "core_info": core_info_data,
        }

        new_snapshot = DocumentVersion(
            document_id=document_id,
            description=description,
            snapshot_data=snapshot_data,
            created_by=None,
        )
        new_snapshot = await DocumentMapper.create_snapshot(db, new_snapshot)
        await db.commit()

        return {
            "version_id": new_snapshot.version_id,
            "document_id": new_snapshot.document_id,
            "description": new_snapshot.description,
            "snapshot_data": new_snapshot.snapshot_data,
            "created_at": new_snapshot.created_at,
            "created_by": new_snapshot.created_by,
        }

    @staticmethod
    async def update_snapshot(db: AsyncSession, snapshot_id: UUID, description: str):
        """更新快照信息"""
        result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")

        await DocumentMapper.update_snapshot(db, snapshot_id, {"description": description})
        await db.commit()

        updated_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        updated_snapshot = updated_result.scalar_one_or_none()

        return {
            "version_id": updated_snapshot.version_id,
            "document_id": updated_snapshot.document_id,
            "description": updated_snapshot.description,
            "snapshot_data": updated_snapshot.snapshot_data,
            "created_at": updated_snapshot.created_at,
            "created_by": updated_snapshot.created_by
        }

    @staticmethod
    async def restore_snapshot(db: AsyncSession, document_id: UUID, snapshot_id: UUID):
        """
        从快照恢复文档（全量恢复：章节+段落+摘要+核心信息）

        恢复策略：
        - 删除现有章节（级联删除段落）、摘要、核心信息
        - 用快照里的原始 ID 重建，依赖边因 ID 不变自动有效
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        snapshot = await DocumentMapper.get_snapshot_by_id(db, snapshot_id, document_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")

        data = snapshot.snapshot_data

        # 1. 删除现有数据（章节级联删除段落）
        await db.execute(sa_delete(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id))
        await db.execute(sa_delete(DocumentSummary).where(DocumentSummary.document_id == document_id))
        await db.execute(sa_delete(Chapter).where(Chapter.document_id == document_id))
        await db.flush()

        # 2. 恢复章节
        for ch in data.get("chapters", []):
            chapter = Chapter(
                chapter_id=ch["chapter_id"],
                document_id=document_id,
                parent_id=ch.get("parent_id"),
                title=ch["title"],
                field_key=ch.get("field_key"),
                status=ch.get("status", 0),
                order_index=ch.get("order_index", 0),
            )
            db.add(chapter)
        await db.flush()

        # 3. 恢复段落
        for ch in data.get("chapters", []):
            for para in ch.get("paragraphs", []):
                paragraph = Paragraph(
                    paragraph_id=para["paragraph_id"],
                    chapter_id=ch["chapter_id"],
                    content=para.get("content", ""),
                    para_type=para.get("para_type", "paragraph"),
                    order_index=para.get("order_index", 0),
                    ai_eval=para.get("ai_eval"),
                    ai_suggestion=para.get("ai_suggestion"),
                    ai_generate=para.get("ai_generate"),
                    ischange=para.get("ischange", 0),
                )
                db.add(paragraph)

        # 4. 恢复摘要
        for s in data.get("summaries", []):
            summary = DocumentSummary(
                summary_id=s["summary_id"],
                document_id=document_id,
                title=s["title"],
                field_key=s["field_key"],
                content=s.get("content", ""),
                version=s.get("version", 1),
                is_change=s.get("is_change", 0),
                order_index=s.get("order_index", 0),
            )
            db.add(summary)

        # 5. 恢复核心信息（先插父节点再插子节点）
        core_info_list = data.get("core_info", [])
        core_info_list_sorted = sorted(
            core_info_list,
            key=lambda x: (x.get("parent_id") is not None, x.get("order_index", 0))
        )
        for ci in core_info_list_sorted:
            core_info = DocumentCoreInfo(
                core_info_id=ci["core_info_id"],
                document_id=document_id,
                parent_id=ci.get("parent_id"),
                title=ci["title"],
                field_key=ci.get("field_key"),
                content=ci.get("content", ""),
                field_type=ci.get("field_type", "text"),
                options=ci.get("options"),
                is_required=ci.get("is_required", True),
                order_index=ci.get("order_index", 0),
                is_locked=ci.get("is_locked", False),
                is_change=0,
            )
            db.add(core_info)

        await db.commit()
        return {"message": f"已从快照 {snapshot.description} 恢复文档"}
