from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Paragraph, Chapter, Document, StructureTemplate
from schemas.schemas import ParagraphCreate, ParagraphUpdate
from uuid import UUID
from fastapi import HTTPException
from core.constants import EdgeSourceType, EdgeTargetType
from services.ai_client import call_qwen_once

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
            para_type="paragraph",  # 默认类型为正文
            order_index=order_index,
            ai_eval=None,  # 默认为null
            ai_suggestion=None,  # 默认为null
            ai_generate=None,  # 默认为null
            ischange=0  # 默认为0
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
            para_type="paragraph",
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
        应用AI帮填结果，将ai_generate字段的内容填充到content字段。
        反哺用的 instruction 从数据库的 ai_instruction 字段取，与 ai_generate 严格配对。
        """
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            raise HTTPException(status_code=404, detail="段落不存在")

        print(f"[apply] ai_instruction={paragraph.ai_instruction!r}")

        if not paragraph.ai_generate:
            raise HTTPException(status_code=400, detail="AI帮填结果不存在")

        # 先保存 instruction，update 后对象状态可能被刷新
        saved_instruction = paragraph.ai_instruction

        update_data = {
            "content": paragraph.ai_generate,
            "ischange": 0,
            "ai_instruction": None,
        }

        await ParagraphMapper.update_paragraph(db, paragraph_id, update_data)
        await db.commit()

        # 反哺模板（有 ai_instruction 时触发，与 ai_generate 严格配对）
        if saved_instruction and saved_instruction.strip():
            print(f"[反哺] 触发反哺，instruction={saved_instruction!r}")
            try:
                await ParagraphService._feedback_to_template(db, paragraph_id, saved_instruction.strip())
            except Exception as e:
                import traceback
                print(f"[反哺] 异常: {e}")
                traceback.print_exc()
        else:
            print(f"[反哺] ai_instruction 为空，跳过。值={saved_instruction!r}")

        return await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)

    @staticmethod
    async def _feedback_to_template(db: AsyncSession, paragraph_id: UUID, instruction: str):
        paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
        if not paragraph:
            print(f"[反哺] 段落不存在: {paragraph_id}")
            return

        chapter_result = await db.execute(
            select(Chapter).where(Chapter.chapter_id == paragraph.chapter_id)
        )
        chapter = chapter_result.scalar_one_or_none()
        if not chapter or not chapter.field_key:
            print(f"[反哺] 章节无 field_key，跳过。chapter_id={paragraph.chapter_id}, field_key={getattr(chapter, 'field_key', None)}")
            return

        print(f"[反哺] 章节 field_key={chapter.field_key}, instruction={instruction}")

        doc_result = await db.execute(
            select(Document).where(Document.document_id == chapter.document_id)
        )
        document = doc_result.scalar_one_or_none()
        if not document or not document.template_id:
            print(f"[反哺] 文档无 template_id，跳过。document_id={chapter.document_id}")
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
            print(f"[反哺] 未找到对应 StructureTemplate，template_id={document.template_id}, field_key={chapter.field_key}")
            return

        current_prompt = struct_template.custom_prompt or struct_template.default_prompt or ""
        print(f"[反哺] 当前 custom_prompt={current_prompt!r}")

        optimize_prompt = (
            f"现有提示词：\n{current_prompt}\n\n"
            f"用户对生成结果的反馈：{instruction}\n\n"
            "请根据以上反馈，对提示词进行优化改写，使其能更好地指导 AI 生成符合用户期望的内容。"
            "直接输出优化后的提示词，不要解释。"
        )

        try:
            result = await call_qwen_once("你是一位专业的 prompt 工程师。", [], optimize_prompt)
            new_prompt = result.get("content", "").strip()
            print(f"[反哺] AI 优化后 prompt={new_prompt!r}")
            if new_prompt:
                await db.execute(
                    sa_update(StructureTemplate)
                    .where(StructureTemplate.structure_template_id == struct_template.structure_template_id)
                    .values(custom_prompt=new_prompt)
                )
                await db.commit()
                print(f"[反哺] custom_prompt 已更新，structure_template_id={struct_template.structure_template_id}")
        except Exception as e:
            print(f"[反哺] AI 优化 prompt 失败: {e}")
    
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
