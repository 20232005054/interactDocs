"""
摘要变更后台处理服务

流程：
1. embedding 判断是否实质变更
2. 不是实质变更 → is_change=0，结束
3. 是实质变更 → 查依赖该摘要的下游章节
4. 对每个章节，找对应 StructureTemplate，取 generation_mode：
   - mode=0：复制模式重新生成段落
   - mode=1：render_ai_content 重新生成段落
   - mode=2：直接使用，跳过联动
   - mode=3：以 content_template 为草稿调 AI 修改
5. 更新段落内容，ischange=2
6. is_change=0 重置
"""

import logging
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import AsyncSessionLocal
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from db.models import DocumentSummary, Chapter
from core.constants import EdgeTargetType, EdgeSourceType
from services.summary_template_service import SummaryTemplateService
from services.event_bus import publish

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.92


async def _is_substantial_change(old_content: str, new_content: str) -> bool:
    if not old_content.strip() or not new_content.strip():
        return True
    if old_content.strip() == new_content.strip():
        return False
    try:
        from services.ai_client import get_embedding, cosine_similarity  # 避免循环依赖
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
            is_substantial = await _is_substantial_change(old_content, new_content)
            if not is_substantial:
                await db.execute(
                    update(DocumentSummary)
                    .where(DocumentSummary.summary_id == summary_id)
                    .values(is_change=0)
                )
                await db.commit()
                logger.info("摘要 %s 内容未实质变更，跳过联动", summary_id)
                return

            await _process_downstream(db, summary_id)

            await db.execute(
                update(DocumentSummary)
                .where(DocumentSummary.summary_id == summary_id)
                .values(is_change=0)
            )
            await db.commit()

        except Exception as e:
            logger.error("摘要变更后台处理失败 summary_id=%s: %s", summary_id, e)


async def _process_downstream(db: AsyncSession, summary_id: UUID):
    """处理所有依赖该摘要的下游章节"""
    edges = await DependencyEdgeMapper.get_edges_by_target(
        db, EdgeTargetType.SUMMARY, summary_id
    )

    if not edges:
        logger.info("摘要 %s 没有下游章节依赖，跳过联动", summary_id)
        return

    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return
    document = await DocumentMapper.get_document_by_id(db, summary.document_id)
    if not document:
        return

    structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)

    for edge in edges:
        if edge.source_type != EdgeSourceType.CHAPTER:
            continue
        await _handle_chapter_downstream(db, edge.source_id, document, structure_templates)


async def _handle_chapter_downstream(db: AsyncSession, chapter_id: UUID, document, structure_templates: list):
    """更新章节下的段落内容（按 paragraphs 定义遍历）"""
    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    para_defs = template.paragraphs or []
    if not para_defs:
        return

    paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
    para_by_idx = {p.order_index: p for p in paragraphs}

    for para_idx, para_def in enumerate(para_defs):
        mode = para_def.get("generation_mode", 2)
        target_paragraph = para_by_idx.get(para_idx)
        if not target_paragraph:
            continue

        if mode == 2:
            logger.info("章节 %s 段落[%d] (mode=2) 直接使用模式，跳过联动", chapter_id, para_idx)
            continue

        if mode == 0:
            source_data_map = await SummaryTemplateService.build_sources_data_map(
                db=db, document=document, sources=para_def.get("sources") or []
            )
            new_content = SummaryTemplateService.generate_content_copy_mode(
                para_def.get("content_template"), para_def.get("sources"), source_data_map
            )
            await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                "content": new_content,
                "ischange": 2,
            })
            logger.info("章节 %s 段落[%d] (mode=0) 已重新生成", chapter_id, para_idx)

        elif mode in (1, 3):
            try:
                from services.structure_template_service import StructureTemplateService
                source_data_map = await SummaryTemplateService.build_sources_data_map(
                    db=db, document=document, sources=para_def.get("sources") or []
                )
                new_content = await StructureTemplateService.render_ai_content_for_paragraph(
                    db=db,
                    document=document,
                    chapter_title=chapter.title,
                    para_def=para_def,
                    field_key=f"{template.field_key}[{para_idx}]",
                    template_id=str(template.structure_template_id),
                    source_data_map=source_data_map,
                )
                if new_content:
                    await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                        "content": new_content,
                        "ai_generate": new_content,
                        "ischange": 2,
                    })
                    logger.info("章节 %s 段落[%d] (mode=%d) AI 重新生成完成", chapter_id, para_idx, mode)
                    await publish(str(document.document_id), {
                        "type": "paragraph_updated",
                        "chapter_id": str(chapter_id),
                        "paragraph_id": str(target_paragraph.paragraph_id),
                    })
                else:
                    logger.warning("章节 %s 段落[%d] (mode=%d) AI 返回空内容", chapter_id, para_idx, mode)
            except Exception as e:
                logger.error("章节 %s 段落[%d] AI 重新生成失败: %s", chapter_id, para_idx, e)
                await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 2})
