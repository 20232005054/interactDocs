"""
核心信息变更后台处理服务

流程：
1. 查找依赖该核心信息的下游（summary / chapter）
2. 对每个下游：
   - mode=0：直接重新执行复制模式生成，更新内容
   - mode=1：先用 embedding 判断是否实质变更，是则调用 render_ai_content 重新生成
3. 更新 is_change 标记
"""

import logging
import uuid
from uuid import UUID

from db.session import AsyncSessionLocal
from db.mappers.dependency_edge_mapper import DependencyEdgeMapper
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.models import DocumentSummary, Paragraph
from core.constants import EdgeTargetType, EdgeSourceType
from services.summary_template_service import SummaryTemplateService

logger = logging.getLogger(__name__)

# 语义相似度阈值，高于此值认为不是实质变更
SIMILARITY_THRESHOLD = 0.92


async def _is_substantial_change(old_content: str, new_content: str) -> bool:
    """用 embedding 余弦相似度判断是否实质变更"""
    if not old_content.strip() or not new_content.strip():
        return True
    if old_content.strip() == new_content.strip():
        return False
    try:
        from services.ai_client import get_embedding, cosine_similarity
        vec_old = await get_embedding(old_content)
        vec_new = await get_embedding(new_content)
        sim = await cosine_similarity(vec_old, vec_new)
        logger.info("embedding similarity: %.4f (threshold=%.2f)", sim, SIMILARITY_THRESHOLD)
        return sim <= SIMILARITY_THRESHOLD
    except Exception as e:
        logger.warning("embedding 判断失败，降级为字符串比较: %s", e)
        # 降级：简单字符串比较
        return old_content.strip() != new_content.strip()


async def handle_core_info_change_async(
    core_info_id: UUID,
    old_content: str,
    new_content: str,
):
    """
    后台任务入口：处理核心信息变更后的下游联动更新
    使用独立 db session，不依赖请求生命周期
    """
    async with AsyncSessionLocal() as db:
        try:
            await _process_downstream(db, core_info_id, old_content, new_content)
            # 变更处理完成，重置 is_change
            from sqlalchemy import update
            from db.models import DocumentCoreInfo
            await db.execute(
                update(DocumentCoreInfo)
                .where(DocumentCoreInfo.core_info_id == core_info_id)
                .values(is_change=0)
            )
            await db.commit()
        except Exception as e:
            logger.error("核心信息变更后台处理失败 core_info_id=%s: %s", core_info_id, e)


async def _process_downstream(db, core_info_id: UUID, old_content: str, new_content: str):
    """处理所有依赖该核心信息的下游"""
    # 查找所有依赖该核心信息的边（反向查：target=core_info）
    edges = await DependencyEdgeMapper.get_edges_by_target(
        db, EdgeTargetType.CORE_INFO, core_info_id
    )

    if not edges:
        logger.info("核心信息 %s 没有下游依赖，跳过联动", core_info_id)
        return

    # 获取核心信息所属文档
    core_info = await CoreInfoMapper.get_core_info_by_id(db, core_info_id)
    if not core_info:
        return
    document = await DocumentMapper.get_document_by_id(db, core_info.document_id)
    if not document:
        return

    for edge in edges:
        source_type = edge.source_type
        source_id = edge.source_id

        if source_type == EdgeSourceType.SUMMARY:
            await _handle_summary_downstream(
                db, source_id, document, old_content, new_content
            )
        elif source_type == EdgeSourceType.CHAPTER:
            await _handle_chapter_downstream(
                db, source_id, document, old_content, new_content
            )


async def _handle_summary_downstream(db, summary_id: UUID, document, old_content: str, new_content: str):
    """处理摘要下游"""
    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
    if not summary:
        return

    # 找到对应的 SummaryTemplate（通过 field_key 匹配）
    summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in summary_templates if t.field_key == summary.field_key), None)
    if not template:
        logger.warning("找不到摘要 %s 对应的模板", summary_id)
        return

    if template.generation_mode == 0:
        # 复制模式：直接重新生成
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
        # AI 模式：先判断是否实质变更
        is_substantial = await _is_substantial_change(old_content, new_content)
        if not is_substantial:
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 0})
            logger.info("摘要 %s (mode=1) 内容未实质变更，跳过", summary_id)
            return

        try:
            new_summary_content = await SummaryTemplateService.render_ai_content(
                db=db,
                document=document,
                summary_template=template,
            )
            if new_summary_content:
                await SummaryMapper.update_summary(db, summary_id, {
                    "content": new_summary_content,
                    "is_change": 2
                })
                logger.info("摘要 %s (mode=1) AI 重新生成完成", summary_id)
            else:
                logger.warning("摘要 %s (mode=1) AI 返回空内容", summary_id)
        except Exception as e:
            logger.error("摘要 %s AI 重新生成失败: %s", summary_id, e)
            await SummaryMapper.update_summary(db, summary_id, {"is_change": 2})


async def _handle_chapter_downstream(db, chapter_id: UUID, document, old_content: str, new_content: str):
    """处理章节下游（更新章节的初始段落）"""
    from sqlalchemy import select
    from db.models import Chapter

    result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return

    # 找到对应的 StructureTemplate（通过章节 field_key 匹配）
    structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
    template = next((t for t in structure_templates if t.field_key == chapter.field_key), None)
    if not template:
        logger.warning("找不到章节 %s 对应的结构模板", chapter_id)
        return

    # 取章节的第一个段落
    paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
    target_paragraph = next((p for p in paragraphs if p.para_type == "paragraph"), None)
    if not target_paragraph:
        return

    if template.generation_mode == 0:
        # 复制模式：直接重新生成
        source_data_map = await SummaryTemplateService.build_sources_data_map(
            db=db, document=document, sources=template.sources or []
        )
        new_content_para = SummaryTemplateService.generate_content_copy_mode(
            template.content_template, template.sources, source_data_map
        )
        await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
            "content": new_content_para,
            "ischange": 2
        })
        logger.info("章节 %s 段落 (mode=0) 已重新生成", chapter_id)

    elif template.generation_mode == 1:
        # AI 模式：先判断是否实质变更
        is_substantial = await _is_substantial_change(old_content, new_content)
        if not is_substantial:
            await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 0})
            logger.info("章节 %s 段落 (mode=1) 内容未实质变更，跳过", chapter_id)
            return

        try:
            new_para_content = await SummaryTemplateService.render_ai_content(
                db=db,
                document=document,
                summary_template=template,  # StructureTemplate 结构与 SummaryTemplate 兼容
            )
            if new_para_content:
                await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {
                    "content": new_para_content,
                    "ai_generate": new_para_content,
                    "ischange": 2
                })
                logger.info("章节 %s 段落 (mode=1) AI 重新生成完成", chapter_id)
            else:
                logger.warning("章节 %s 段落 (mode=1) AI 返回空内容", chapter_id)
        except Exception as e:
            logger.error("章节 %s 段落 AI 重新生成失败: %s", chapter_id, e)
            await ParagraphMapper.update_paragraph(db, target_paragraph.paragraph_id, {"ischange": 2})
