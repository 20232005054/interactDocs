"""
摘要变更后台处理服务

流程：
1. embedding 判断是否实质变更
2. 不是实质变更 → is_change=0，结束
3. 是实质变更 → 查依赖该摘要的下游章节
4. 对每个章节，找对应 StructureTemplate，取 generation_mode：
   - mode=0：复制模式重新生成段落
   - mode=1：render_ai_content 重新生成段落
5. 更新段落内容，ischange=2
6. is_change=0 重置
"""

import logging
from uuid import UUID

from db.session import AsyncSessionLocal
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from core.constants import EdgeTargetType, EdgeSourceType
from services.summary_template_service import SummaryTemplateService

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.92


async def _is_substantial_change(old_content: str, new_content: str) -> bool:
    if not old_content.strip() or not new_content.strip():
        return True
    if old_content.strip() == new_content.strip():
        return False
    try:
        from services.ai_client import get_embedding, cosine_similarity
        vec_old = await get_embedding(old_content)
        vec_new = await get_embedding(new_content)
        sim = await cosine_similarity(vec_old, vec_new)
        logger.info("summary embedding similarity: %.4f (threshold=%.2f)", sim, SIMILARITY_THRESHOLD)
        return sim <= SIMILARITY_THRESHOLD
    except Exception as e:
        logger.warning("embedding 判断失败，降级为字符串比较: %s", e)
        return old_content.strip() != new_content.strip()


async def handle_summary_change_async(
    summary_id: UUID,
    old_content: str,
    new_content: str,
):
    """后台任务入口：处理摘要变更后的下游章节联动更新"""
    async with AsyncSessionLocal() as db:
        try:
            # embedding 判断是否实质变更
            is_substantial = await _is_substantial_change(old_content, new_content)
            if not is_substantial:
                from sqlalchemy import update
                from db.models import DocumentSummary
                await db.execute(
                    update(DocumentSummary)
                    .where(DocumentSummary.summary_id == summary_id)
                    .values(is_change=0)
                )
                await db.commit()
                logger.info("摘要 %s 内容未实质变更，跳过联动", summary_id)
                return

            await _process_downstream(db, summary_id)

            # 处理完成，重置 is_change
            from sqlalchemy import update
            from db.models import DocumentSummary
            await db.execute(
                update(DocumentSummary)
                .where(DocumentSummary.summary_id == summary_id)
                .values(is_change=0)
            )
            await db.commit()

        except Exception as e:
            logger.error("摘要变更后台处理失败 summary_id=%s: %s", summary_id, e)


async def _process_downstream(db, summary_id: UUID):
    """处理所有依赖该摘要的下游章节"""
    # 反向查：找依赖该摘要的章节边（source_type=chapter, target_type=summary）
    edges = await DependencyEdgeMapper.get_edges_by_target(
        db, EdgeTargetType.SUMMARY, summary_id
    )

    if not edges:
        logger.info("摘要 %s 没有下游章节依赖，跳过联动", summary_id)
        return

    # 获取摘要所属文档
    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return
    document = await DocumentMapper.get_document_by_id(db, summary.document_id)
    if not document:
        return

    # 预加载结构模板
    structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)

    for edge in edges:
        if edge.source_type != EdgeSourceType.CHAPTER:
            continue
        chapter_id = edge.source_id
        await _handle_chapter_downstream(db, chapter_id, document, structure_templates)


async def _handle_chapter_downstream(db, chapter_id: UUID, document, structure_templates: list):
    """更新章节下的段落内容"""
    from sqlalchemy import select
    from db.models import Chapter

    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    # 通过章节 field_key 找对应的 StructureTemplate
    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    # 取章节下第一个正文段落
    paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
    target_paragraph = next((p for p in paragraphs if p.para_type == "paragraph"), None)
    if not target_paragraph:
        return

    if template.generation_mode == 0:
        source_data_map = await SummaryTemplateService.build_sources_data_map(
            db=db, document=document, sources=template.sources or []
        )
        new_content = SummaryTemplateService.generate_content_copy_mode(
            template.content_template, template.sources, source_data_map
        )
        await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
            "content": new_content,
            "ischange": 2
        })
        logger.info("章节 %s 段落 (mode=0) 已重新生成", chapter_id)

    elif template.generation_mode == 1:
        try:
            new_content = await SummaryTemplateService.render_ai_content(
                db=db,
                document=document,
                summary_template=template,
            )
            if new_content:
                await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                    "content": new_content,
                    "ai_generate": new_content,
                    "ischange": 2
                })
                logger.info("章节 %s 段落 (mode=1) AI 重新生成完成", chapter_id)
            else:
                logger.warning("章节 %s 段落 (mode=1) AI 返回空内容", chapter_id)
        except Exception as e:
            logger.error("章节 %s 段落 AI 重新生成失败: %s", chapter_id, e)
            await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 2})
