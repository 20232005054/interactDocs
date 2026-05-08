import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Paragraph, Chapter, Document, StructureTemplate
from schemas.document_schemas import ParagraphCreate, ParagraphUpdate
from uuid import UUID
from fastapi import HTTPException
from core.constants import EdgeSourceType, EdgeTargetType, ParaType
from core.utils import log_task_exception

logger = logging.getLogger(__name__)

class ParagraphService:
    @staticmethod
    async def create_paragraph(db: AsyncSession, chapter_id: UUID, paragraph_in: ParagraphCreate):

        
        # 获取章节的所有段落，确定最大order_index
        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        if paragraphs:
            max_order_index = max(p.order_index for p in paragraphs)
            order_index = max_order_index + 1
        else:
            order_index = 0  # 章节无段落时从0开始
        
        # 创建新段落
        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type=ParaType.PARAGRAPH,
            order_index=order_index,
            ai_eval=None,
            ai_suggestion=None,
            ai_generate=None,
            ischange=0
        )
        
        result = await ParagraphMapper.create_paragraph(db, new_paragraph)
        await db.commit()
        return result

    @staticmethod
    async def update_paragraph(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphUpdate):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        update_data = {}
        if paragraph_in.content is not None:
            update_data["content"] = paragraph_in.content
            # 内容有变化时标记 ischange=1（已被手动修改，与原始生成版本不同）
            if paragraph_in.content != paragraph.content:
                update_data["ischange"] = 1
        if paragraph_in.para_type is not None:
            update_data["para_type"] = paragraph_in.para_type
        if paragraph_in.ai_eval is not None:
            update_data["ai_eval"] = paragraph_in.ai_eval
        if paragraph_in.ai_suggestion is not None:
            update_data["ai_suggestion"] = paragraph_in.ai_suggestion

        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        await db.commit()
        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def delete_paragraph(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        deleted_order_index = paragraph.order_index
        chapter_id = paragraph.chapter_id

        await ParagraphMapper.delete_paragraph(db, paragraph)
        await ParagraphMapper.shift_order_index(db, chapter_id, deleted_order_index + 1, delta=-1)
        await db.commit()

        return {"message": "删除成功"}

    @staticmethod
    async def get_paragraph_detail(db: AsyncSession, paragraph_id: UUID):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")
        return paragraph

    @staticmethod
    async def get_paragraphs_by_chapter_id(db: AsyncSession, chapter_id: UUID):
        return await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)

    @staticmethod
    async def insert_paragraph_after(db: AsyncSession, paragraph_id: UUID, paragraph_in: ParagraphCreate):
        """在指定段落后插入新段落"""
        current_paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not current_paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        current_order_index = current_paragraph.order_index
        chapter_id = current_paragraph.chapter_id
        insert_index = current_order_index + 1

        await ParagraphMapper.shift_order_index(db, chapter_id, insert_index, delta=1)

        new_paragraph = Paragraph(
            chapter_id=chapter_id,
            content=paragraph_in.content,
            para_type=ParaType.PARAGRAPH,
            order_index=insert_index,
            ai_eval=None,
            ai_suggestion=None,
            ai_generate=None,
            ischange=0
        )
        result = await ParagraphMapper.create_paragraph(db, new_paragraph)
        await db.commit()
        return result

    
    @staticmethod
    async def reorder_paragraphs(db: AsyncSession, document_id: UUID, items: list):
        """
        批量重排段落，支持跨章节移动。
        items 每项包含 paragraph_id、chapter_id、order_index。
        依赖边以 paragraph_id 为 source_id，chapter_id 变更不影响依赖关系。
        """
        from db.mappers.document_mapper import DocumentMapper
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        reorder_items = [
            {
                "paragraph_id": item.paragraph_id,
                "chapter_id": item.chapter_id,
                "order_index": item.order_index,
            }
            for item in items
        ]
        await ParagraphMapper.batch_update_chapter_and_order(db, reorder_items)
        await db.commit()

    @staticmethod
    async def apply_ai_assist_result(db: AsyncSession, paragraph_id: UUID):
        """
        应用AI帮填结果，将 ai_generate 填入 content。
        ai_instruction 是与本次 ai_generate 配对的用户修改意见，apply 后读取用于反哺模板，随后清空。
        """
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        logger.info(f"[AI帮填] apply paragraph_id={paragraph_id} ai_instruction={paragraph.ai_instruction!r} has_generate={bool(paragraph.ai_generate)}")

        if not paragraph.ai_generate:
            raise HTTPException(status_code=400, detail="AI帮填结果不存在")

        # 先保存 instruction，update 后对象状态可能被刷新
        saved_instruction = paragraph.ai_instruction

        update_data = {
            "content": paragraph.ai_generate,
            "ischange": 0,
            "ai_instruction": None,  # 清空，防止重复反哺
        }

        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        await db.commit()

        # 反哺模板（有 ai_instruction 时触发，与 ai_generate 严格配对）
        # 后台异步执行，不阻塞 apply 接口响应
        if saved_instruction and saved_instruction.strip():
            logger.info(f"[反哺] 触发后台反哺，instruction={saved_instruction!r}")
            task = asyncio.create_task(
                ParagraphService._feedback_to_template(paragraph_id, saved_instruction.strip()),
                name=f"feedback_template_{paragraph_id}",
            )
            task.add_done_callback(log_task_exception)
        else:
            logger.info(f"[反哺] ai_instruction 为空，跳过。值={saved_instruction!r}")

        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def _feedback_to_template(paragraph_id: UUID, instruction: str):
        """
        反哺模板：将用户修改意见优化到对应段落定义的 custom_prompt。
        使用独立 session，作为后台任务运行，不依赖调用方的 db 连接。
        
        【已迁移到 LangChain PromptOptimizationChain】
        """
        from db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
            if not paragraph:
                logger.warning(f"[反哺] 段落不存在: {paragraph_id}")
                return

            chapter_result = await db.execute(
                select(Chapter).where(Chapter.chapter_id == paragraph.chapter_id)
            )
            chapter = chapter_result.scalar_one_or_none()
            if not chapter or not chapter.field_key:
                logger.warning(
                    f"[反哺] 章节无 field_key，跳过。chapter_id={paragraph.chapter_id}, "
                    f"field_key={getattr(chapter, 'field_key', None)}"
                )
                return

            logger.info(f"[反哺] 章节 field_key={chapter.field_key}, instruction={instruction}")

            doc_result = await db.execute(
                select(Document).where(Document.document_id == chapter.document_id)
            )
            document = doc_result.scalar_one_or_none()
            if not document or not document.template_id:
                logger.warning(f"[反哺] 文档无 template_id，跳过。document_id={chapter.document_id}")
                return

            struct_result = await db.execute(
                select(StructureTemplate)
                .where(
                    StructureTemplate.template_id == document.template_id,
                    StructureTemplate.field_key == chapter.field_key,
                )
            )
            struct_template = struct_result.scalar_one_or_none()
            if not struct_template:
                logger.warning(
                    f"[反哺] 未找到对应 StructureTemplate，"
                    f"template_id={document.template_id}, field_key={chapter.field_key}"
                )
                return

            # 用 para_def_idx 定位对应的段落定义
            para_def_idx = paragraph.para_def_idx
            if para_def_idx is None:
                logger.warning(f"[反哺] 段落无 para_def_idx（用户手动创建），跳过反哺")
                return

            para_defs = struct_template.paragraphs or []
            if para_def_idx >= len(para_defs):
                logger.warning(
                    f"[反哺] para_def_idx={para_def_idx} 超出 paragraphs 范围"
                    f"（len={len(para_defs)}），跳过"
                )
                return

            para_def = para_defs[para_def_idx]
            mode = para_def.get("generation_mode", 2)
            if mode not in (1, 3):
                logger.info(f"[反哺] 段落定义 mode={mode}，非 AI 模式，跳过反哺")
                return

            current_prompt = para_def.get("custom_prompt") or para_def.get("default_prompt") or ""
            logger.info(f"[反哺] 当前 prompt={current_prompt!r}, para_def_idx={para_def_idx}")

            try:
                # 使用 LangChain PromptOptimizationChain
                from services.langchain.chains.prompt_optimization_chain import (
                    create_prompt_optimization_chain
                )
                
                chain = create_prompt_optimization_chain()
                new_prompt = await chain.optimize(
                    current_prompt=current_prompt,
                    user_feedback=instruction,
                )
                
                logger.info(f"[反哺] AI 优化后 prompt={new_prompt!r}")
                
                if new_prompt and new_prompt.strip():
                    # 更新 paragraphs 数组里对应段落定义的 custom_prompt
                    new_para_defs = list(para_defs)
                    new_para_def = dict(new_para_defs[para_def_idx])
                    new_para_def["custom_prompt"] = new_prompt.strip()
                    new_para_defs[para_def_idx] = new_para_def
                    
                    await db.execute(
                        sa_update(StructureTemplate)
                        .where(StructureTemplate.structure_template_id == struct_template.structure_template_id)
                        .values(paragraphs=new_para_defs)
                    )
                    await db.commit()
                    logger.info(f"[反哺] paragraphs[{para_def_idx}].custom_prompt 已更新")
                else:
                    logger.warning(f"[反哺] AI 返回空 prompt，跳过更新")
                    
            except Exception as e:
                logger.error(f"[反哺] AI 优化 prompt 失败: {e}", exc_info=True)
    
    @staticmethod
    async def get_paragraph_related_summaries(db: AsyncSession, paragraph_id: UUID):
        """获取段落关联的摘要信息（批量查询，避免 N+1）"""
        edges = await DependencyEdgeMapper.get_edges_by_source_and_target_type(
            db, EdgeSourceType.PARAGRAPH, paragraph_id, EdgeTargetType.SUMMARY
        )
        if not edges:
            return []

        summary_ids = [edge.target_id for edge in edges]
        summaries = await SummaryMapper.get_summaries_by_ids(db, summary_ids)

        edge_map = {edge.target_id: edge for edge in edges}
        return [
            {
                "summary_id": s.summary_id,
                "document_id": s.document_id,
                "title": s.title,
                "field_key": s.field_key,
                "content": s.content,
                "version": s.version,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
                "relevance_score": edge_map[s.summary_id].relevance_score,
            }
            for s in summaries
            if s.summary_id in edge_map
        ]

    @staticmethod
    async def confirm_change(db: AsyncSession, paragraph_id: UUID):
        """
        确认段落变更，将 ischange 重置为 0。
        用于用户确认已查看并接受段落的变更状态。
        """
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        # 重置变更标记
        update_data = {"ischange": 0}
        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        await db.commit()

        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
