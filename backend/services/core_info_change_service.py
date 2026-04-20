"""
核心信息变更后台处理服务

流程：
1. 查找依赖该核心信息的下游（summary / chapter）
2. 对每个下游：
   - mode=0：直接重新执行复制模式生成，更新内容
   - mode=1：先用 embedding 判断是否实质变更，是则调用 render_ai_content 重新生成
   - mode=2：直接使用，跳过联动
   - mode=3：以 content_template 为草稿调 AI 修改
3. 更新 is_change 标记
"""

import logging
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import AsyncSessionLocal
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.models import DocumentSummary, DocumentCoreInfo, Chapter
from core.constants import EdgeTargetType, EdgeSourceType
from services.summary_template_service import SummaryTemplateService
from services.event_bus import publish

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.92


async def _is_substantial_change(old_content: str, new_content: str) -> bool:
    """用 embedding 余弦相似度判断是否实质变更"""
    if not old_content.strip() or not new_content.strip():
        return True
    if old_content.strip() == new_content.strip():
        return False
    try:
        from services.ai_client import get_embedding, cosine_similarity  # 避免循环依赖
        vec_old = await get_embedding(old_content)
        vec_new = await get_embedding(new_content)
        sim = await cosine_similarity(vec_old, vec_new)
        logger.info("embedding similarity: %.4f (threshold=%.2f)", sim, SIMILARITY_THRESHOLD)
        return sim <= SIMILARITY_THRESHOLD
    except Exception as e:
        logger.warning("embedding 判断失败，降级为字符串比较: %s", e)
        return old_content.strip() != new_content.strip()


async def handle_core_info_change_async(
    core_info_id: UUID,
    old_content: str,
    new_content: str,
):
    """后台任务入口：处理核心信息变更后的下游联动更新"""
    async with AsyncSessionLocal() as db:
        try:
            await _process_downstream(db, core_info_id, old_content, new_content)
            await db.execute(
                update(DocumentCoreInfo)
                .where(DocumentCoreInfo.core_info_id == core_info_id)
                .values(is_change=0)
            )
            await db.commit()
        except Exception as e:
            logger.error("核心信息变更后台处理失败 core_info_id=%s: %s", core_info_id, e)


async def _process_downstream(db: AsyncSession, core_info_id: UUID, old_content: str, new_content: str):
    """处理所有依赖该核心信息的下游"""
    edges = await DependencyEdgeMapper.get_edges_by_target(
        db, EdgeTargetType.CORE_INFO, core_info_id
    )

    if not edges:
        logger.info("核心信息 %s 没有下游依赖，跳过联动", core_info_id)
        return

    core_info = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
    if not core_info:
        return
    document = await DocumentMapper.get_document_by_id(db, core_info.document_id)
    if not document:
        return

    for edge in edges:
        if edge.source_type == EdgeSourceType.SUMMARY:
            await _handle_summary_downstream(db, edge.source_id, document, old_content, new_content)
        elif edge.source_type == EdgeSourceType.CHAPTER:
            await _handle_chapter_downstream(db, edge.source_id, document, old_content, new_content)


async def _handle_summary_downstream(
    db: AsyncSession, summary_id: UUID, document, old_content: str, new_content: str
):
    """处理摘要下游"""
    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return

    summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in summary_templates if t.field_key == summary.field_key), None)
    if not template:
        logger.warning("找不到摘要 %s 对应的模板", summary_id)
        return

    if template.generation_mode == 0:
        source_data_map = await SummaryTemplateService.build_sources_data_map(
            db=db, document=document, sources=template.sources or []
        )
        new_summary_content = SummaryTemplateService.generate_content_copy_mode(
            template.content_template, template.sources, source_data_map
        )
        await SummaryMapper.update_summary(db, summary_id, {
            "content": new_summary_content,
            "is_change": 2
        })
        logger.info("摘要 %s (mode=0) 已重新生成", summary_id)

    elif template.generation_mode == 1:
        is_substantial = await _is_substantial_change(old_content, new_content)
        if not is_substantial:
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 0})
            logger.info("摘要 %s (mode=1) 内容未实质变更，跳过", summary_id)
            return
        try:
            new_summary_content = await SummaryTemplateService.render_ai_content(
                db=db, document=document, summary_template=template,
            )
            if new_summary_content:
                await SummaryMapper.update_summary(db, summary_id, {
                    "content": new_summary_content,
                    "is_change": 2
                })
                logger.info("摘要 %s (mode=1) AI 重新生成完成", summary_id)
                await publish(str(document.document_id), {
                    "type": "summary_updated",
                    "summary_id": str(summary_id),
                })
            else:
                logger.warning("摘要 %s (mode=1) AI 返回空内容", summary_id)
        except Exception as e:
            logger.error("摘要 %s AI 重新生成失败: %s", summary_id, e)
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 2})

    elif template.generation_mode == 2:
        # 直接使用模式：内容固定，上游变更不影响
        logger.info("摘要 %s (mode=2) 直接使用模式，跳过联动", summary_id)

    elif template.generation_mode == 3:
        # AI修改模式：以 content_template 为草稿重新生成
        is_substantial = await _is_substantial_change(old_content, new_content)
        if not is_substantial:
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 0})
            logger.info("摘要 %s (mode=3) 内容未实质变更，跳过", summary_id)
            return
        try:
            new_summary_content = await SummaryTemplateService.render_ai_content(
                db=db, document=document, summary_template=template,
                draft=template.content_template,
            )
            if new_summary_content:
                await SummaryMapper.update_summary(db, summary_id, {
                    "content": new_summary_content,
                    "is_change": 2
                })
                logger.info("摘要 %s (mode=3) AI 修改重新生成完成", summary_id)
                await publish(str(document.document_id), {
                    "type": "summary_updated",
                    "summary_id": str(summary_id),
                })
            else:
                logger.warning("摘要 %s (mode=3) AI 返回空内容", summary_id)
        except Exception as e:
            logger.error("摘要 %s (mode=3) AI 修改失败: %s", summary_id, e)
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 2})


async def _handle_chapter_downstream(
    db: AsyncSession, chapter_id: UUID, document, old_content: str, new_content: str
):
    """处理章节下游（按段落定义遍历，更新所有需要联动的段落）"""
    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    para_defs = template.paragraphs or []
    if not para_defs:
        return

    paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
    # 按 order_index 建立映射
    para_by_idx = {p.order_index: p for p in paragraphs}

    for para_idx, para_def in enumerate(para_defs):
        mode = para_def.get("generation_mode", 2)
        target_paragraph = para_by_idx.get(para_idx)
        if not target_paragraph:
            continue

        if mode == 2:
            # 直接使用模式：内容固定，上游变更不影响
            logger.info("章节 %s 段落[%d] (mode=2) 直接使用模式，跳过联动", chapter_id, para_idx)
            continue

        if mode == 0:
            source_data_map = await SummaryTemplateService.build_sources_data_map(
                db=db, document=document, sources=para_def.get("sources") or []
            )
            new_para_content = SummaryTemplateService.generate_content_copy_mode(
                para_def.get("content_template"), para_def.get("sources"), source_data_map
            )
            await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                "content": new_para_content,
                "ischange": 2,
            })
            logger.info("章节 %s 段落[%d] (mode=0) 已重新生成", chapter_id, para_idx)

        elif mode in (1, 3):
            is_substantial = await _is_substantial_change(old_content, new_content)
            if not is_substantial:
                await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 0})
                logger.info("章节 %s 段落[%d] (mode=%d) 内容未实质变更，跳过", chapter_id, para_idx, mode)
                continue
            try:
                source_data_map = await SummaryTemplateService.build_sources_data_map(
                    db=db, document=document, sources=para_def.get("sources") or []
                )
                from services.structure_template_service import StructureTemplateService
                new_para_content = await StructureTemplateService.render_ai_content_for_paragraph(
                    db=db,
                    document=document,
                    chapter_title=chapter.title,
                    para_def=para_def,
                    field_key=f"{template.field_key}[{para_idx}]",
                    template_id=str(template.structure_template_id),
                    source_data_map=source_data_map,
                )
                if new_para_content:
                    await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                        "content": new_para_content,
                        "ai_generate": new_para_content,
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
