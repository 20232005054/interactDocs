from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.models import DocumentSummary, DocumentSummaryHistory
from schemas.schemas import DocumentSummaryUpdate
from uuid import UUID
from sqlalchemy import func, select, update
from fastapi import HTTPException
from db.mappers.paragraph_mapper import ParagraphMapper


class SummaryService:
    @staticmethod
    async def get_summary_by_id(db: AsyncSession, summary_id: UUID):
        return await SummaryMapper.get_summary_by_id(db, summary_id)

    @staticmethod
    async def get_summaries_by_document_id(db: AsyncSession, document_id: UUID):
        return await SummaryMapper.get_summaries_by_document_id(db, document_id)

    @staticmethod
    async def update_summary(db: AsyncSession, summary_id: UUID, summary_in: DocumentSummaryUpdate):
        # 获取旧摘要
        old_summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not old_summary:
            return None
        
        # 检查是否有实质性变更
        # 处理 content 为空字符串的情况
        from services.ai_service import is_substantial_change
        new_content = summary_in.content if summary_in.content is not None else old_summary.content
        is_change = await is_substantial_change(old_summary.content, new_content)
        
        # 创建历史记录
        history = DocumentSummaryHistory(
            summary_id=summary_id,
            version=old_summary.version,
            title=old_summary.title,
            content=old_summary.content
        )
        db.add(history)
        
        # 直接更新现有摘要记录，增加版本号
        update_data = {
            "title": summary_in.title if summary_in.title is not None else old_summary.title,
            "content": new_content,
            "order_index": old_summary.order_index,  # 保持原有排序索引
            "version": old_summary.version + 1,
            "is_change": 1 if is_change else 0
        }
        updated_summary = await SummaryMapper.update_summary(db, summary_id, update_data)
        
        # 处理关联段落更新，传递变更状态
        await SummaryService._handle_summary_change(db, old_summary, updated_summary, is_change)
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
            
            return {"message": "删除成功"}
        return {"message": "摘要不存在"}
    
    @staticmethod
    async def create_default_summary(db: AsyncSession, document_id: UUID):
        """
        创建默认摘要（标题为"新摘要"，内容为空）
        """
        # 计算order_index
        count_result = await db.execute(
            select(func.count(DocumentSummary.summary_id))
            .where(DocumentSummary.document_id == document_id)
        )
        count = count_result.scalar() or 0
        order_index = count
        
        # 创建新摘要
        new_summary = DocumentSummary(
            document_id=document_id,    # 关联文档
            title="新摘要",                # 默认标题
            content="",                  # 空内容
            version=1,                   # 初始版本号
            order_index=order_index      # 排序索引
        )
        
        return await SummaryMapper.create_summary(db, new_summary)
    
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
            document_id=document_id,    # 关联文档
            title="新摘要",                # 默认标题
            content="",                  # 空内容
            version=1,                   # 初始版本号
            order_index=target_order_index + 1  # 插入到目标摘要后
        )
        
        return await SummaryMapper.create_summary(db, new_summary)
    
    @staticmethod
    async def apply_ai_assist_result(db: AsyncSession, summary_id: UUID):
        """
        应用AI帮填结果，将ai_generate字段的内容填入content字段
        """
        # 获取摘要信息
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not summary:
            raise HTTPException(status_code=404, detail="摘要不存在")
        
        if not summary.ai_generate:
            raise HTTPException(status_code=400, detail="AI帮填结果不存在")
        
        # 构建更新数据
        update_data = {
            "content": summary.ai_generate,
            "is_change": 0  # 标记为已变更
        }
        
        # 更新摘要
        await SummaryMapper.update_summary(db, summary_id, update_data)
        
        # 返回更新后的摘要
        return await SummaryMapper.get_summary_by_id(db, summary_id)



    @staticmethod
    async def _handle_summary_change(db: AsyncSession, old_summary: DocumentSummary, new_summary: DocumentSummary, is_substantial_change):
        """
        处理摘要变更时的段落更新
        当摘要发生实质变更时，调用AI重新生成依赖该摘要的段落内容
        """
        if not is_substantial_change:
            return
        
        # 获取与摘要关联的段落（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_target(
            db, "summary", old_summary.summary_id
        )
        
        # 在函数内部导入，避免循环导入
        from services.ai_service import ai_assist_paragraph
        from schemas.schemas import AIAssistRequest
        
        for edge in edges:
            paragraph_id = edge.source_id
            
            # 调用AI帮填段落，传入变更的摘要信息作为上游依赖
            # 构建上游摘要信息
            upstream_summary = {
                "summary_id": str(new_summary.summary_id),
                "title": new_summary.title,
                "content": new_summary.content
            }
            
            # 创建帮填请求（不指定特定摘要，让AI使用upstream_summary）
            assist_request = AIAssistRequest()
            
            try:
                # 调用AI生成段落内容
                full_content = ""
                async for chunk in ai_assist_paragraph(db, paragraph_id, assist_request, upstream_summary):
                    # 解析SSE格式的数据
                    if chunk.startswith("data: "):
                        import json
                        data_str = chunk[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "content" in data:
                                full_content += data["content"]
                        except json.JSONDecodeError:
                            pass
                
                # 更新段落的ai_generate和ischange字段
                # ischange=2 表示因上游摘要变更而需要更新

                await ParagraphMapper.update_paragraph(db, paragraph_id, {
                    "ai_generate": full_content,
                    "ischange": 2
                })
                
            except Exception as e:
                print(f"处理摘要变更时更新段落失败: {e}")
                # 即使AI生成失败，也要标记段落需要更新

                await ParagraphMapper.update_paragraph(db, paragraph_id, {"ischange": 2})
    @staticmethod
    async def get_summary_related_paragraphs(db: AsyncSession, summary_id: UUID):
        """
        获取摘要关联的段落信息
        """
        # 获取摘要的所有关联链接（通过DependencyEdge表）
        edges = await DependencyEdgeMapper.get_edges_by_target(
            db, "summary", summary_id
        )
        
        related_paragraphs = []
        for edge in edges:
            # 获取段落详情
            from db.mappers.paragraph_mapper import ParagraphMapper
            paragraph = await ParagraphMapper.get_paragraph_by_id(db, edge.source_id)
            if paragraph:
                # 直接使用纯文本内容
                related_paragraphs.append({
                    "paragraph_id": paragraph.paragraph_id,
                    "chapter_id": paragraph.chapter_id,
                    "content": paragraph.content,
                    "para_type": paragraph.para_type,
                    "order_index": paragraph.order_index,
                    "ai_eval": paragraph.ai_eval,
                    "ai_suggestion": paragraph.ai_suggestion,
                    "summary_version": edge.target_version,
                    "relevance_score": edge.relevance_score
                })
        
        return related_paragraphs

