from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.models import DocumentSummary, DocumentSummaryHistory
from schemas.schemas import DocumentSummaryUpdate
from uuid import UUID
from sqlalchemy import func, select, update
from fastapi import HTTPException
from db.mappers.paragraph_mapper import ParagraphMapper
from core.constants import EdgeSourceType, EdgeTargetType


from uuid import uuid4

class SummaryService:
    @staticmethod
    async def get_summary_by_id(db: AsyncSession, summary_id: UUID):
        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def get_summaries_by_document_id(db: AsyncSession, document_id: UUID):
        return await SummaryMapper.get_summaries_by_document_id(db, document_id)

    @staticmethod
    async def update_summary(db: AsyncSession, summary_id: UUID, summary_in: DocumentSummaryUpdate):
        old_summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not old_summary:
            return None

        new_content = summary_in.content if summary_in.content is not None else old_summary.content
        new_title = summary_in.title if summary_in.title is not None else old_summary.title

        # 创建历史记录
        history = DocumentSummaryHistory(
            summary_id=summary_id,
            version=old_summary.version,
            title=old_summary.title,
            field_key=old_summary.field_key,
            content=old_summary.content,
        )
        db.add(history)

        # 乐观标记 is_change=1，立即保存
        update_data = {
            "title": new_title,
            "content": new_content,
            "order_index": old_summary.order_index,
            "version": old_summary.version + 1,
            "is_change": 1 if new_content != old_summary.content else 0,
        }
        updated_summary = await SummaryMapper.update_summary(db, summary_id, update_data)
        await db.commit()

        # 内容有变化时启动后台任务
        if new_content != old_summary.content:
            import asyncio
            from services.summary_change_service import handle_summary_change_async
            from core.utils import log_task_exception
            task = asyncio.create_task(
                handle_summary_change_async(summary_id, old_summary.content, new_content),
                name=f"summary_change_{summary_id}",
            )
            task.add_done_callback(log_task_exception)

        return updated_summary

    @staticmethod
    async def delete_summary(db: AsyncSession, summary_id: UUID):
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if summary:
            # 记录要删除的摘要的order_index
            deleted_order_index = summary.order_index
            document_id = summary.document_id
            
            # 删除摘要
            await SummaryMapper.delete_summary(db, summary)
            
            # 更新后续摘要的order_index
            from sqlalchemy import update
            await db.execute(
                update(DocumentSummary)
                .where(DocumentSummary.document_id == document_id)
                .where(DocumentSummary.order_index > deleted_order_index)
                .values(order_index=DocumentSummary.order_index - 1)
            )
            await db.commit()
            return {"message": "删除成功"}
        return {"message": "摘要不存在"}
    
    @staticmethod
    async def create_default_summary(db: AsyncSession, document_id: UUID):
        """
        创建默认摘要（标题为"新摘要"，内容为空）
        """
        # 计算order_index：取同文档下最大值+1
        max_result = await db.execute(
            select(func.max(DocumentSummary.order_index))
            .where(DocumentSummary.document_id == document_id)
        )
        max_val = max_result.scalar()
        order_index = (max_val + 1) if max_val is not None else 0
        
        # 创建新摘要
        new_summary = DocumentSummary(
            document_id=document_id,
            title="新摘要",
            field_key="summary_" + uuid4().hex[:8],
            content="",
            version=1,
            is_change=0,
            order_index=order_index
        )
        
        result = await SummaryMapper.create_summary(db, new_summary)
        await db.commit()
        return result
    
    @staticmethod
    async def insert_summary_after(db: AsyncSession, summary_id: UUID):
        """
        在指定摘要后插入新的默认摘要
        """
        # 获取指定摘要信息
        target_summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not target_summary:
            return None
        
        document_id = target_summary.document_id
        target_order_index = target_summary.order_index
        
        # 更新后续摘要的order_index
        await db.execute(
            update(DocumentSummary)
            .where(DocumentSummary.document_id == document_id)
            .where(DocumentSummary.order_index > target_order_index)
            .values(order_index=DocumentSummary.order_index + 1)
        )
        
        # 创建新摘要
        new_summary = DocumentSummary(
            document_id=document_id,
            title="新摘要",
            field_key="summary_" + uuid4().hex[:8],
            content="",
            version=1,
            is_change=0,
            order_index=target_order_index + 1
        )
        
        result = await SummaryMapper.create_summary(db, new_summary)
        await db.commit()
        return result
    
    @staticmethod
    async def apply_ai_assist_result(db: AsyncSession, summary_id: UUID):
        """
        应用AI帮填结果，将ai_generate字段的内容填入content字段。
        内容变更后触发下游联动（与手动编辑摘要保持一致）。
        """
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not summary:
            raise HTTPException(status_code=404, detail="摘要不存在")

        if not summary.ai_generate:
            raise HTTPException(status_code=400, detail="AI帮填结果不存在")

        old_content = summary.content
        new_content = summary.ai_generate

        # 创建历史记录
        from db.models import DocumentSummaryHistory
        history = DocumentSummaryHistory(
            summary_id=summary_id,
            version=summary.version,
            title=summary.title,
            field_key=summary.field_key,
            content=old_content,
        )
        db.add(history)

        update_data = {
            "content": new_content,
            "version": summary.version + 1,
            "is_change": 1 if new_content != old_content else 0,
        }
        await SummaryMapper.update_summary(db, summary_id, update_data)
        await db.commit()

        # 内容有变化时启动下游联动后台任务（与 update_summary 保持一致）
        if new_content != old_content:
            import asyncio
            from services.summary_change_service import handle_summary_change_async
            from core.utils import log_task_exception
            task = asyncio.create_task(
                handle_summary_change_async(summary_id, old_content, new_content),
                name=f"summary_change_{summary_id}",
            )
            task.add_done_callback(log_task_exception)

        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def reorder(db: AsyncSession, document_id: UUID, ordered_ids: list):
        """
        批量重排摘要顺序。
        ordered_ids 为同文档下摘要 ID 的新顺序列表，按位置赋 order_index。
        """
        summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        existing_ids = {s.summary_id for s in summaries}

        for sid in ordered_ids:
            if sid not in existing_ids:
                raise HTTPException(status_code=400, detail=f"摘要 {sid} 不属于该文档")

        order_map = {sid: idx for idx, sid in enumerate(ordered_ids)}
        await SummaryMapper.bulk_update_order(db, order_map)
        await db.commit()

    @staticmethod
    async def confirm_ai_change(db: AsyncSession, summary_id: UUID):
        """
        确认 is_change=3 的 AI 重新生成结果：将 ai_generate 写入 content，is_change 归零。
        """
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not summary:
            raise HTTPException(status_code=404, detail="摘要不存在")
        if summary.is_change != 3:
            raise HTTPException(status_code=400, detail="当前摘要没有待确认的 AI 生成内容")
        if not summary.ai_generate:
            raise HTTPException(status_code=400, detail="AI 生成内容为空")

        history = DocumentSummaryHistory(
            summary_id=summary_id,
            version=summary.version,
            title=summary.title,
            field_key=summary.field_key,
            content=summary.content,
        )
        db.add(history)

        await SummaryMapper.update_summary(db, summary_id, {
            "content": summary.ai_generate,
            "ai_generate": None,
            "version": summary.version + 1,
            "is_change": 0,
        })
        await db.commit()
        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def reject_ai_change(db: AsyncSession, summary_id: UUID):
        """
        拒绝 is_change=3 的 AI 重新生成结果：清空 ai_generate，is_change 归零。
        """
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not summary:
            raise HTTPException(status_code=404, detail="摘要不存在")
        if summary.is_change != 3:
            raise HTTPException(status_code=400, detail="当前摘要没有待确认的 AI 生成内容")

        await SummaryMapper.update_summary(db, summary_id, {
            "ai_generate": None,
            "is_change": 0,
        })
        await db.commit()
        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def get_summary_related_paragraphs(db: AsyncSession, summary_id: UUID):
        """获取摘要关联的段落信息（批量查询，避免 N+1）"""
        edges = await DependencyEdgeMapper.get_edges_by_target(
            db, EdgeTargetType.SUMMARY, summary_id
        )
        if not edges:
            return []

        para_ids = [edge.source_id for edge in edges]
        paragraphs = await ParagraphMapper.get_paragraphs_by_ids(db, para_ids)

        edge_map = {edge.source_id: edge for edge in edges}
        return [
            {
                "paragraph_id": p.paragraph_id,
                "chapter_id": p.chapter_id,
                "content": p.content,
                "para_type": p.para_type,
                "order_index": p.order_index,
                "ai_eval": p.ai_eval,
                "ai_suggestion": p.ai_suggestion,
                "summary_version": edge_map[p.paragraph_id].target_version,
                "relevance_score": edge_map[p.paragraph_id].relevance_score,
            }
            for p in paragraphs
            if p.paragraph_id in edge_map
        ]

