"""
内容变更后台处理服务

统一处理核心信息和摘要变更后的下游联动更新。

流程：
1. 检测是否实质变更（embedding 相似度）
2. 查找下游依赖关系
3. 根据 generation_mode 重新生成内容：
   - mode=0：复制模式（变量替换）
   - mode=1：AI 生成
   - mode=2：直接使用（跳过联动）
   - mode=3：AI 修改（草稿润色）
4. 更新 is_change 标记
5. 发送 SSE 事件通知前端
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
from services.change_detection_service import ChangeDetectionService

logger = logging.getLogger(__name__)


# ============================================================================
# 核心信息变更处理
# ============================================================================

async def handle_core_info_change_async(
    core_info_id: UUID,
    old_content: str,
    new_content: str,
):
    """后台任务入口：处理核心信息变更后的下游联动更新"""
    async with AsyncSessionLocal() as db:
        try:
            await _process_core_info_downstream(db, core_info_id, old_content, new_content)
            await db.execute(
                update(DocumentCoreInfo)
                .where(DocumentCoreInfo.core_info_id == core_info_id)
                .values(is_change=0)
            )
            await db.commit()
        except Exception as e:
            logger.error("核心信息变更后台处理失败 core_info_id=%s: %s", core_info_id, e, exc_info=True)


async def _process_core_info_downstream(
    db: AsyncSession,
    core_info_id: UUID,
    old_content: str,
    new_content: str
):
    """处理核心信息的所有下游依赖"""
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
            await _handle_summary_downstream(
                db, edge.source_id, document, old_content, new_content
            )
        elif edge.source_type == EdgeSourceType.CHAPTER:
            await _handle_chapter_downstream_from_core_info(
                db, edge.source_id, document, old_content, new_content
            )


async def _handle_summary_downstream(
    db: AsyncSession,
    summary_id: UUID,
    document,
    old_content: str,
    new_content: str
):
    """处理摘要下游（核心信息变更触发）"""
    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return

    summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in summary_templates if t.field_key == summary.field_key), None)
    if not template:
        logger.warning("找不到摘要 %s 对应的模板", summary_id)
        return

    # Mode 0: 复制模式
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
        return

    # Mode 2: 直接使用
    if template.generation_mode == 2:
        logger.info("摘要 %s (mode=2) 直接使用模式，跳过联动", summary_id)
        return

    # Mode 1/3: AI 生成/修改
    if template.generation_mode in (1, 3):
        is_substantial = await ChangeDetectionService.is_substantial_change(old_content, new_content)
        if not is_substantial:
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 0})
            logger.info("摘要 %s (mode=%d) 内容未实质变更，跳过", summary_id, template.generation_mode)
            return

        try:
            draft = template.content_template if template.generation_mode == 3 else None
            new_summary_content = await SummaryTemplateService.render_ai_content(
                db=db,
                document=document,
                summary_template=template,
                draft=draft,
            )
            if new_summary_content:
                await SummaryMapper.update_summary(db, summary_id, {
                    "content": new_summary_content,
                    "is_change": 2
                })
                logger.info("摘要 %s (mode=%d) AI 重新生成完成", summary_id, template.generation_mode)
                await publish(str(document.document_id), {
                    "type": "summary_updated",
                    "summary_id": str(summary_id),
                })
            else:
                logger.warning("摘要 %s (mode=%d) AI 返回空内容", summary_id, template.generation_mode)
        except Exception as e:
            logger.error("摘要 %s AI 重新生成失败: %s", summary_id, e, exc_info=True)
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 2})


async def _handle_chapter_downstream_from_core_info(
    db: AsyncSession,
    chapter_id: UUID,
    document,
    old_content: str,
    new_content: str
):
    """处理章节下游（核心信息变更触发）"""
    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    await _update_chapter_paragraphs(
        db, chapter_id, chapter, document, template, old_content, new_content
    )


# ============================================================================
# 摘要变更处理
# ============================================================================

async def handle_summary_change_async(
    summary_id: UUID,
    old_content: str,
    new_content: str,
):
    """后台任务入口：处理摘要变更后的下游章节联动更新"""
    async with AsyncSessionLocal() as db:
        try:
            is_substantial = await ChangeDetectionService.is_substantial_change(old_content, new_content)
            if not is_substantial:
                await db.execute(
                    update(DocumentSummary)
                    .where(DocumentSummary.summary_id == summary_id)
                    .values(is_change=0)
                )
                await db.commit()
                logger.info("摘要 %s 内容未实质变更，跳过联动", summary_id)
                return

            await _process_summary_downstream(db, summary_id)

            await db.execute(
                update(DocumentSummary)
                .where(DocumentSummary.summary_id == summary_id)
                .values(is_change=0)
            )
            await db.commit()

        except Exception as e:
            logger.error("摘要变更后台处理失败 summary_id=%s: %s", summary_id, e, exc_info=True)


async def _process_summary_downstream(db: AsyncSession, summary_id: UUID):
    """处理摘要的所有下游章节依赖"""
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
        await _handle_chapter_downstream_from_summary(
            db, edge.source_id, document, structure_templates
        )


async def _handle_chapter_downstream_from_summary(
    db: AsyncSession,
    chapter_id: UUID,
    document,
    structure_templates: list
):
    """处理章节下游（摘要变更触发）"""
    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    await _update_chapter_paragraphs(
        db, chapter_id, chapter, document, template, None, None
    )


# ============================================================================
# 共享逻辑：更新章节段落
# ============================================================================

async def _update_chapter_paragraphs(
    db: AsyncSession,
    chapter_id: UUID,
    chapter: Chapter,
    document,
    template,
    old_content: str = None,
    new_content: str = None
):
    """
    更新章节下的段落内容（按 paragraphs 定义遍历）
    
    Args:
        old_content, new_content: 用于实质变更检测（核心信息变更时传入）
    """
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

        # Mode 2: 直接使用
        if mode == 2:
            logger.info("章节 %s 段落[%d] (mode=2) 直接使用模式，跳过联动", chapter_id, para_idx)
            continue

        # Mode 0: 复制模式
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
            continue

        # Mode 1/3: AI 生成/修改
        if mode in (1, 3):
            # 实质变更检测（仅核心信息变更时需要）
            if old_content is not None and new_content is not None:
                is_substantial = await ChangeDetectionService.is_substantial_change(old_content, new_content)
                if not is_substantial:
                    await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 0})
                    logger.info("章节 %s 段落[%d] (mode=%d) 内容未实质变更，跳过", chapter_id, para_idx, mode)
                    continue

            try:
                from services.structure_template_service import StructureTemplateService
                source_data_map = await SummaryTemplateService.build_sources_data_map(
                    db=db, document=document, sources=para_def.get("sources") or []
                )
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
                logger.error("章节 %s 段落[%d] AI 重新生成失败: %s", chapter_id, para_idx, e, exc_info=True)
                await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 2})

