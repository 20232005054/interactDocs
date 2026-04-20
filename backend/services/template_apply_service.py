from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update as sa_update
from db.mappers.document_mapper import DocumentMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Chapter, Paragraph, DocumentCoreInfo, DocumentSummary
from uuid import UUID, uuid4
from fastapi import HTTPException
from services.dependency_service import DependencyService
from services.summary_template_service import SummaryTemplateService
from services.structure_template_service import StructureTemplateService
from services.ai_client import AIClientError
from core.constants import EdgeSourceType, EdgeTargetType
from core.config import AI_MAX_CONCURRENCY


class TemplateApplyService:

    @staticmethod
    def _build_generation_error(
        template_id: str,
        field_key: str,
        generation_mode: int,
        error_type: str,
        error_message: str,
        error_code: str = None,
        duration_ms: int = None,
    ) -> dict:
        from services.ai_client import _ERROR_HINTS
        user_hint = _ERROR_HINTS.get(error_code or "", _ERROR_HINTS.get("AI_REQUEST_ERROR", ""))
        return {
            "trace_id": str(uuid4()),
            "template_id": template_id,
            "field_key": field_key,
            "generation_mode": generation_mode,
            "error_type": error_type,
            "error_message": error_message,
            "error_code": error_code,
            "duration_ms": duration_ms,
            "user_hint": user_hint,
        }

    @staticmethod
    def _extract_ai_error_fields(exc: Exception):
        if isinstance(exc, AIClientError):
            return exc.error_code, exc.duration_ms
        return None, None

    @staticmethod
    async def apply_core_info_template(db: AsyncSession, document_id: UUID):
        """
        应用核心信息模板：根据模板创建文档的核心信息字段
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, document.template_id)

        id_mapping = {}
        for template in core_info_templates:
            id_mapping[template.core_template_id] = uuid4()

        def get_level(tmpl):
            level = 0
            curr = tmpl
            while curr.parent_id:
                level += 1
                curr = next((x for x in core_info_templates if x.core_template_id == curr.parent_id), None)
                if not curr:
                    break
            return level

        core_info_templates_sorted = sorted(core_info_templates, key=get_level)

        created_items = []
        for template in core_info_templates_sorted:
            core_info = DocumentCoreInfo(
                core_info_id=id_mapping[template.core_template_id],
                document_id=document_id,
                parent_id=id_mapping.get(template.parent_id) if template.parent_id else None,
                title=template.field_name,
                field_key=template.field_key,
                content=template.default_value or "",
                field_type=template.field_type,
                options=template.options,
                is_required=template.is_required,
                order_index=template.order_index,
                is_locked=False,
                is_change=0
            )
            db.add(core_info)
            created_items.append(core_info)

        await db.commit()
        return created_items

    @staticmethod
    async def apply_summary_template(db: AsyncSession, document_id: UUID):
        """
        应用摘要模板：根据模板创建文档的摘要
        AI 生成模式（mode=1/3）并发执行，Semaphore 控制并发数，减少等待时间
        """
        import asyncio

        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)

        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.field_key: item.core_info_id for item in core_info_list if item.field_key}

        existing_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        summary_id_map = {item.title: item.summary_id for item in existing_summaries}
        existing_summaries_map = {item.title: item.content for item in existing_summaries}

        semaphore = asyncio.Semaphore(AI_MAX_CONCURRENCY)

        # 第一步：并发构建所有 source_data_map（纯数据库读，无需 Semaphore）
        async def build_source_map(template, current_summaries_map):
            try:
                return await SummaryTemplateService.build_sources_data_map(
                    db=db,
                    document=document,
                    sources=template.sources or [],
                    generated_summary_map=current_summaries_map,
                )
            except Exception as exc:
                return exc

        # 第二步：并发执行所有 AI 生成（mode=1 和 mode=3），Semaphore 控制并发数
        async def render_ai(template, current_summaries_map, source_data_map):
            async with semaphore:
                try:
                    draft = template.content_template if template.generation_mode == 3 else None
                    return await SummaryTemplateService.render_ai_content(
                        db=db,
                        document=document,
                        summary_template=template,
                        generated_summary_map=current_summaries_map,
                        source_data_map=source_data_map,
                        draft=draft,
                    )
                except Exception as exc:
                    return exc

        # 并发构建所有 source_data_map
        source_map_results = await asyncio.gather(*[
            build_source_map(t, existing_summaries_map) for t in summary_templates
        ])

        # 对 mode=1 和 mode=3 并发执行 AI 生成
        ai_indices = [i for i, t in enumerate(summary_templates) if t.generation_mode in (1, 3)]
        ai_coros = [
            render_ai(
                summary_templates[i],
                existing_summaries_map,
                source_map_results[i] if not isinstance(source_map_results[i], Exception) else {}
            )
            for i in ai_indices
            if not isinstance(source_map_results[i], Exception)
        ]
        ai_results_raw = await asyncio.gather(*ai_coros, return_exceptions=True)
        ai_results = {}
        valid_ai_idx = [i for i in ai_indices if not isinstance(source_map_results[i], Exception)]
        for idx, result in zip(valid_ai_idx, ai_results_raw):
            ai_results[idx] = result

        # 串行写库
        created_items = []
        generated_summary_map = {}
        for idx, template in enumerate(summary_templates):
            content = ""
            generation_mode = template.generation_mode
            generation_error = None
            source_data_map = source_map_results[idx] if not isinstance(source_map_results[idx], Exception) else {}

            if isinstance(source_map_results[idx], Exception):
                exc = source_map_results[idx]
                error_code, duration_ms = TemplateApplyService._extract_ai_error_fields(exc)
                generation_error = TemplateApplyService._build_generation_error(
                    template_id=str(template.summary_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                    error_code=error_code,
                    duration_ms=duration_ms,
                )

            if generation_mode == 0:
                content = SummaryTemplateService.generate_content_copy_mode(
                    template.content_template, template.sources, source_data_map
                )
            elif generation_mode in (1, 3):
                ai_result = ai_results.get(idx)
                if isinstance(ai_result, Exception):
                    error_code, duration_ms = TemplateApplyService._extract_ai_error_fields(ai_result)
                    generation_error = TemplateApplyService._build_generation_error(
                        template_id=str(template.summary_template_id),
                        field_key=template.field_key,
                        generation_mode=generation_mode,
                        error_type=type(ai_result).__name__,
                        error_message=str(ai_result),
                        error_code=error_code,
                        duration_ms=duration_ms,
                    )
                elif ai_result:
                    content = ai_result

                if not content:
                    if generation_error is None:
                        generation_error = TemplateApplyService._build_generation_error(
                            template_id=str(template.summary_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type="AIEmptyResponse",
                            error_message="AI返回为空，已降级到复制模式",
                            error_code="AI_EMPTY_RESPONSE",
                        )
                    content = SummaryTemplateService.generate_content_copy_mode(
                        template.content_template, template.sources, source_data_map
                    )
            elif generation_mode == 2:
                # 直接使用：content_template 原文，不做任何替换
                content = template.content_template or ""
            else:
                generation_error = TemplateApplyService._build_generation_error(
                    template_id=str(template.summary_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type="UnsupportedGenerationMode",
                    error_message=f"不支持的generation_mode: {generation_mode}，已降级到复制模式",
                    error_code="UNSUPPORTED_GENERATION_MODE",
                )
                content = SummaryTemplateService.generate_content_copy_mode(
                    template.content_template, template.sources, source_data_map
                )

            degraded = generation_error is not None
            summary_data = {
                "document_id": document_id,
                "title": template.title,
                "field_key": template.field_key,
                "content": content,
                "version": 1,
                "is_change": 0,
                "ai_generate": content if generation_mode in (1, 3) and not degraded else None,
                "order_index": idx
            }
            summary = DocumentSummary(**summary_data)
            db.add(summary)
            await db.flush()

            generated_summary_map[template.field_key] = content
            summary_id_map[template.field_key] = summary.summary_id

            # 建立依赖边
            if template.sources:
                for src in template.sources:
                    source_obj = src.get("source")
                    source_type = source_obj.get("value") if isinstance(source_obj, dict) else None
                    match_keys = src.get("match_keys") or []

                    for mk in match_keys:
                        match_key = mk.get("value") if isinstance(mk, dict) else None
                        if not match_key:
                            continue

                        target_id = None
                        target_type = None

                        if source_type == "keyinfo":
                            target_type = EdgeTargetType.CORE_INFO
                            target_id = core_info_id_map.get(match_key)
                        elif source_type == "summary":
                            target_type = EdgeTargetType.SUMMARY
                            target_id = summary_id_map.get(match_key)
                        elif source_type == "chapter":
                            target_type = EdgeTargetType.CHAPTER

                        if target_type and target_id:
                            await DependencyService.create_dependency_edge(
                                db=db,
                                source_type=EdgeSourceType.SUMMARY,
                                source_id=summary.summary_id,
                                target_type=target_type,
                                target_id=target_id,
                                document_id=document_id
                            )

            created_items.append({
                "summary": summary,
                "template_id": str(template.summary_template_id),
                "generation_mode": generation_mode,
                "sources": template.sources,
                "degraded": degraded,
                "generation_error": generation_error,
            })

        await db.commit()
        return created_items

    @staticmethod
    async def apply_structure_template(db: AsyncSession, document_id: UUID):
        """
        应用文章结构模板：根据模板创建文档的章节结构
        每个章节按 paragraphs 定义创建多个段落。
        两阶段执行：
        阶段一 - 串行创建所有章节 + 非AI段落，建立 ID 映射
        阶段二 - 并发执行所有 AI 段落生成，Semaphore 控制并发数
        """
        import asyncio

        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)

        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.field_key: item.core_info_id for item in core_info_list if item.field_key}

        existing_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        summary_id_map = {item.field_key: item.summary_id for item in existing_summaries}

        structure_field_key_to_id = {tmpl.field_key: tmpl.structure_template_id for tmpl in structure_templates}

        sorted_templates = sorted(structure_templates, key=lambda x: (x.level, x.order_index))

        # ----------------------------------------------------------------
        # 阶段一：串行创建所有章节 + 非AI段落
        # paragraph_ai_tasks: [(chapter, template, para_idx, para_def, paragraph_id)]
        # ----------------------------------------------------------------
        template_id_map = {}    # structure_template_id -> chapter_id
        paragraph_ai_tasks = [] # 待 AI 生成的段落任务
        created_chapters = []

        for template in sorted_templates:
            chapter = Chapter(
                document_id=document_id,
                parent_id=template_id_map.get(template.parent_id) if template.parent_id else None,
                title=template.title,
                field_key=template.field_key,
                status=0,
                order_index=template.order_index,
            )
            db.add(chapter)
            await db.flush()
            template_id_map[template.structure_template_id] = chapter.chapter_id

            para_defs = template.paragraphs or []
            chapter_paragraphs = []  # 本章节创建的段落列表

            for para_idx, para_def in enumerate(para_defs):
                mode = para_def.get("generation_mode", 2)
                content = ""

                if mode == 0:
                    # 复制模式：变量替换
                    source_data_map = {}
                    try:
                        source_data_map = await StructureTemplateService.build_sources_data_map(
                            db=db, document=document, sources=para_def.get("sources") or []
                        )
                    except Exception:
                        pass
                    content = SummaryTemplateService.generate_content_copy_mode(
                        para_def.get("content_template"), para_def.get("sources"), source_data_map
                    )
                elif mode == 2:
                    # 直接使用：原文不替换
                    content = para_def.get("content_template") or ""
                # mode=1/3 先留空，阶段二填充

                paragraph = Paragraph(
                    chapter_id=chapter.chapter_id,
                    content=content,
                    para_type=para_def.get("para_type", "paragraph"),
                    order_index=para_idx,
                    para_def_idx=para_idx,
                    ischange=0,
                )
                db.add(paragraph)
                await db.flush()
                chapter_paragraphs.append(paragraph)

                if mode in (1, 3):
                    paragraph_ai_tasks.append((chapter, template, para_idx, para_def, paragraph.paragraph_id))

            created_chapters.append({
                "chapter": chapter,
                "template": template,
                "paragraphs": chapter_paragraphs,
                "degraded": False,
                "generation_error": None,
            })

        await db.commit()

        # ----------------------------------------------------------------
        # 阶段二：并发执行所有 AI 段落生成
        # ----------------------------------------------------------------
        if paragraph_ai_tasks:
            semaphore = asyncio.Semaphore(AI_MAX_CONCURRENCY)

            async def run_ai_para(chapter, template, para_idx, para_def, paragraph_id):
                async with semaphore:
                    mode = para_def.get("generation_mode", 1)
                    source_data_map = {}
                    generation_error = None

                    try:
                        source_data_map = await StructureTemplateService.build_sources_data_map(
                            db=db, document=document, sources=para_def.get("sources") or []
                        )
                    except Exception as exc:
                        error_code, duration_ms = TemplateApplyService._extract_ai_error_fields(exc)
                        generation_error = TemplateApplyService._build_generation_error(
                            template_id=str(template.structure_template_id),
                            field_key=f"{template.field_key}[{para_idx}]",
                            generation_mode=mode,
                            error_type=type(exc).__name__,
                            error_message=str(exc),
                            error_code=error_code,
                            duration_ms=duration_ms,
                        )

                    content = ""
                    if generation_error is None:
                        try:
                            content = await StructureTemplateService.render_ai_content_for_paragraph(
                                db=db,
                                document=document,
                                chapter_title=chapter.title,
                                para_def=para_def,
                                field_key=f"{template.field_key}[{para_idx}]",
                                template_id=str(template.structure_template_id),
                                source_data_map=source_data_map,
                            )
                        except Exception as exc:
                            error_code, duration_ms = TemplateApplyService._extract_ai_error_fields(exc)
                            generation_error = TemplateApplyService._build_generation_error(
                                template_id=str(template.structure_template_id),
                                field_key=f"{template.field_key}[{para_idx}]",
                                generation_mode=mode,
                                error_type=type(exc).__name__,
                                error_message=str(exc),
                                error_code=error_code,
                                duration_ms=duration_ms,
                            )

                    if not content:
                        if generation_error is None:
                            generation_error = TemplateApplyService._build_generation_error(
                                template_id=str(template.structure_template_id),
                                field_key=f"{template.field_key}[{para_idx}]",
                                generation_mode=mode,
                                error_type="AIEmptyResponse",
                                error_message="AI返回为空，已降级到复制模式",
                                error_code="AI_EMPTY_RESPONSE",
                            )
                        # 降级：复制模式
                        content = SummaryTemplateService.generate_content_copy_mode(
                            para_def.get("content_template"), para_def.get("sources"), source_data_map
                        )

                    return paragraph_id, content, generation_error

            results = await asyncio.gather(
                *[run_ai_para(*task) for task in paragraph_ai_tasks],
                return_exceptions=True,
            )

            # 批量更新段落内容
            for result in results:
                if isinstance(result, Exception):
                    continue
                paragraph_id, content, generation_error = result
                if content:
                    await db.execute(
                        sa_update(Paragraph)
                        .where(Paragraph.paragraph_id == paragraph_id)
                        .values(
                            content=content,
                            ai_generate=content if generation_error is None else None,
                        )
                    )
                # 把 generation_error 写回对应章节
                if generation_error:
                    for item in created_chapters:
                        if any(p.paragraph_id == paragraph_id for p in item["paragraphs"]):
                            item["degraded"] = True
                            item["generation_error"] = generation_error
                            break

            await db.commit()

        # ----------------------------------------------------------------
        # 建立依赖边（按段落定义里的 sources 遍历）
        # ----------------------------------------------------------------
        for item in created_chapters:
            chapter = item["chapter"]
            template = item["template"]
            para_defs = template.paragraphs or []

            for para_def in para_defs:
                sources = para_def.get("sources") or []
                for src in sources:
                    source_obj = src.get("source")
                    source_type = source_obj.get("value") if isinstance(source_obj, dict) else None
                    match_keys = src.get("match_keys") or []
                    for mk in match_keys:
                        match_key = mk.get("value") if isinstance(mk, dict) else None
                        if not match_key:
                            continue
                        target_id = None
                        target_type = None
                        if source_type == "keyinfo":
                            target_type = EdgeTargetType.CORE_INFO
                            target_id = core_info_id_map.get(match_key)
                        elif source_type == "summary":
                            target_type = EdgeTargetType.SUMMARY
                            target_id = summary_id_map.get(match_key)
                        elif source_type == "chapter":
                            target_type = EdgeTargetType.CHAPTER
                            ref_template_id = structure_field_key_to_id.get(match_key)
                            if ref_template_id:
                                target_id = template_id_map.get(ref_template_id)
                        if target_type and target_id:
                            await DependencyService.create_dependency_edge(
                                db=db,
                                source_type=EdgeSourceType.CHAPTER,
                                source_id=chapter.chapter_id,
                                target_type=target_type,
                                target_id=target_id,
                                document_id=document_id,
                            )

        await db.commit()
        return created_chapters
