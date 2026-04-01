import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from uuid import UUID, uuid4
from typing import Dict, List, Any, Optional
from fastapi import HTTPException

from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.chapter_mapper import ChapterMapper
from db.models import (
    Document,
    Chapter,
    Paragraph,
    DocumentVersion,
    Template,
    CoreInfoTemplate,
    SummaryTemplate,
    StructureTemplate,
    DocumentCoreInfo,
    DocumentSummary,
)
from schemas.schemas import DocumentCreate, DocumentUpdate, PaginationParams
from services.dependency_service import DependencyService
from services.langchain import (
    get_llm_client,
    format_summary_prompt,
    format_structure_prompt,
    parse_summary_output,
    parse_structure_output,
    build_sources_data_map,
    format_sources_data_for_prompt,
)


class DocumentServiceV2:
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
        return {
            "trace_id": str(uuid4()),
            "template_id": template_id,
            "field_key": field_key,
            "generation_mode": generation_mode,
            "error_type": error_type,
            "error_message": error_message,
            "error_code": error_code,
            "duration_ms": duration_ms,
        }

    @staticmethod
    def _render_template_variables(template_text: str, variables: dict) -> str:
        if not template_text:
            return ""
        safe_variables = variables or {}
        pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

        def replacer(match):
            key = match.group(1)
            return str(safe_variables.get(key, ""))

        return pattern.sub(replacer, template_text)

    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate):
        system_template = await TemplateMapper.get_template(db, doc_in.template_id)
        if not system_template:
            raise HTTPException(status_code=404, detail="模板不存在")

        new_template_obj = Template(
            group_id=system_template.group_id,
            purpose=system_template.purpose,
            display_name=system_template.display_name,
            content=system_template.content,
            version=1,
            is_system=False,
            user_id=None,
            is_active=True,
        )
        new_template = await TemplateMapper.create_template(db, new_template_obj)

        old_core_infos = await CoreInfoTemplateMapper.get_by_template_id(
            db, system_template.template_id
        )
        if old_core_infos:
            # 按 order_index 排序，然后按 parent_id（先处理根节点）
            sorted_old_core_infos = sorted(old_core_infos, key=lambda x: (x.parent_id is not None, x.order_index))
            
            core_info_id_mapping = {}  # 用于记录 旧core_template_id -> 新core_template_id
            new_core_infos = []
            
            for old_ci in sorted_old_core_infos:
                new_core_template_id = uuid4()
                core_info_id_mapping[old_ci.core_template_id] = new_core_template_id
                
                # 确定新的 parent_id
                new_parent_id = None
                if old_ci.parent_id:
                    new_parent_id = core_info_id_mapping.get(old_ci.parent_id)
                
                new_ci = CoreInfoTemplate(
                    core_template_id=new_core_template_id,
                    template_id=new_template.template_id,
                    parent_id=new_parent_id,
                    field_name=old_ci.field_name,
                    field_key=old_ci.field_key,
                    field_type=old_ci.field_type,
                    default_value=old_ci.default_value,
                    options=old_ci.options,
                    is_required=old_ci.is_required,
                    order_index=old_ci.order_index,
                )
                new_core_infos.append(new_ci)
            
            await CoreInfoTemplateMapper.batch_create(db, new_core_infos)

        old_summaries = await SummaryTemplateMapper.get_by_template_id(
            db, system_template.template_id
        )
        if old_summaries:
            new_summaries = []
            for old_sum in old_summaries:
                new_sum = SummaryTemplate(
                    template_id=new_template.template_id,
                    field_key=old_sum.field_key,
                    title=old_sum.title,
                    generation_mode=old_sum.generation_mode,
                    content_template=old_sum.content_template,
                    sources=old_sum.sources,
                    default_prompt=old_sum.default_prompt,
                    custom_prompt=old_sum.custom_prompt,
                    order_index=old_sum.order_index,
                )
                new_summaries.append(new_sum)
            await SummaryTemplateMapper.batch_create(db, new_summaries)

        old_structures = await StructureTemplateMapper.get_by_template_id(
            db, system_template.template_id
        )
        if old_structures:
            sorted_old_structures = sorted(old_structures, key=lambda x: x.level)

            id_mapping = {}
            new_structures = []

            for old_struct in sorted_old_structures:
                new_struct_id = uuid4()
                id_mapping[old_struct.structure_template_id] = new_struct_id

                new_parent_id = None
                if old_struct.parent_id:
                    new_parent_id = id_mapping.get(old_struct.parent_id)

                new_struct = StructureTemplate(
                    structure_template_id=new_struct_id,
                    template_id=new_template.template_id,
                    parent_id=new_parent_id,
                    field_key=old_struct.field_key,
                    title=old_struct.title,
                    level=old_struct.level,
                    generation_mode=old_struct.generation_mode,
                    content_template=old_struct.content_template,
                    sources=old_struct.sources,
                    default_prompt=old_struct.default_prompt,
                    custom_prompt=old_struct.custom_prompt,
                    order_index=old_struct.order_index,
                )
                new_structures.append(new_struct)

            await StructureTemplateMapper.batch_create(db, new_structures)

        new_document = Document(
            title=doc_in.title,
            purpose=doc_in.purpose,
            template_id=new_template.template_id,
        )

        created_document = await DocumentMapper.create_document(db, new_document)

        new_template.document_id = created_document.document_id
        await db.commit()
        await db.refresh(created_document)

        return created_document

    @staticmethod
    async def list_documents(db: AsyncSession, pagination: PaginationParams):
        page = pagination.page
        page_size = pagination.page_size
        count_result = await db.execute(select(func.count()).select_from(Document))
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document)
            .order_by(Document.updated_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        documents = result.scalars().all()

        return total, documents

    @staticmethod
    async def get_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        return document

    @staticmethod
    async def update_document(
        db: AsyncSession, document_id: UUID, doc_in: DocumentUpdate
    ):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        update_data = {}
        if doc_in.title is not None:
            update_data["title"] = doc_in.title
        if doc_in.purpose is not None:
            update_data["purpose"] = doc_in.purpose
        if doc_in.template_id is not None:
            update_data["template_id"] = doc_in.template_id

        await DocumentMapper.update_document(db, document_id, update_data)
        return await DocumentMapper.get_document_by_id(db, document_id)

    @staticmethod
    async def delete_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        await DocumentMapper.delete_document(db, document)
        return {"message": "删除成功"}

    @staticmethod
    async def get_document_snapshots(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        snapshots = await DocumentMapper.get_snapshots_by_document_id(db, document_id)

        snapshot_list = []
        for snapshot in snapshots:
            snapshot_list.append(
                {
                    "version_id": snapshot.version_id,
                    "document_id": snapshot.document_id,
                    "description": snapshot.description,
                    "snapshot_data": snapshot.snapshot_data,
                    "created_at": snapshot.created_at,
                    "created_by": snapshot.created_by,
                }
            )

        return snapshot_list

    @staticmethod
    async def get_snapshot_detail(
        db: AsyncSession, document_id: UUID, snapshot_id: UUID
    ):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        snapshot = await DocumentMapper.get_snapshot_by_id(db, snapshot_id, document_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")

        if "chapters" in snapshot.snapshot_data:
            for chapter in snapshot.snapshot_data["chapters"]:
                if "paragraphs" not in chapter:
                    chapter["paragraphs"] = []

        result_data = {
            "version_id": snapshot.version_id,
            "document_id": snapshot.document_id,
            "description": snapshot.description,
            "snapshot_data": snapshot.snapshot_data,
            "created_at": snapshot.created_at,
            "created_by": snapshot.created_by,
        }

        return result_data

    @staticmethod
    async def apply_core_info_template(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(
            db, document.template_id
        )

        if not core_info_templates:
            return []

        # 按 order_index 排序，然后按 parent_id（先处理根节点）
        sorted_templates = sorted(core_info_templates, key=lambda x: (x.parent_id is not None, x.order_index))

        # ID 映射：旧模板 ID -> 新核心信息 ID
        template_to_core_info_id = {}
        created_items = []

        for template in sorted_templates:
            new_core_info_id = uuid4()
            template_to_core_info_id[template.core_template_id] = new_core_info_id

            # 确定新的 parent_id
            new_parent_id = None
            if template.parent_id:
                new_parent_id = template_to_core_info_id.get(template.parent_id)

            core_info = DocumentCoreInfo(
                core_info_id=new_core_info_id,
                document_id=document_id,
                parent_id=new_parent_id,
                title=template.field_name,
                content=template.default_value or "",
                field_type=template.field_type,
                options=template.options,
                is_required=template.is_required,
                order_index=template.order_index,
                is_locked=False,
                is_change=0,
            )
            db.add(core_info)
            created_items.append(core_info)

        await db.commit()
        return created_items

    @staticmethod
    async def apply_summary_template(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        summary_templates = await SummaryTemplateMapper.get_by_template_id(
            db, document.template_id
        )

        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.title: item.core_info_id for item in core_info_list}

        existing_summaries = await SummaryMapper.get_summaries_by_document_id(
            db, document_id
        )
        summary_id_map = {item.title: item.summary_id for item in existing_summaries}
        existing_summaries_map = {item.title: item.content for item in existing_summaries}

        created_items = []
        generated_summary_map = {}
        core_info_map = {item.title: item.content for item in core_info_list}

        for idx, template in enumerate(summary_templates):
            content = ""
            generation_mode = template.generation_mode
            generation_error = None
            source_data_map = {}

            current_summaries_map = {**existing_summaries_map, **generated_summary_map}

            try:
                source_data_map = await build_sources_data_map(
                    db=db,
                    document_id=str(document_id),
                    sources=template.sources or [],
                )
            except Exception as exc:
                generation_error = DocumentServiceV2._build_generation_error(
                    template_id=str(template.summary_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                )

            if generation_mode == 0:
                content = DocumentServiceV2._generate_copy_mode(
                    content_template=template.content_template,
                    sources=template.sources,
                    source_data_map=source_data_map,
                )
            elif generation_mode == 1:
                if generation_error is None:
                    try:
                        content = await DocumentServiceV2._generate_ai_mode(
                            document=document,
                            template=template,
                            source_data_map=source_data_map,
                        )
                    except Exception as exc:
                        generation_error = DocumentServiceV2._build_generation_error(
                            template_id=str(template.summary_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type=type(exc).__name__,
                            error_message=str(exc),
                        )

                if not content:
                    if generation_error is None:
                        generation_error = DocumentServiceV2._build_generation_error(
                            template_id=str(template.summary_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type="AIEmptyResponse",
                            error_message="AI返回为空，已降级到复制模式",
                            error_code="AI_EMPTY_RESPONSE",
                        )
                    content = DocumentServiceV2._generate_copy_mode(
                        content_template=template.content_template,
                        sources=template.sources,
                        source_data_map=source_data_map,
                    )
            else:
                generation_error = DocumentServiceV2._build_generation_error(
                    template_id=str(template.summary_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type="UnsupportedGenerationMode",
                    error_message=f"不支持的generation_mode: {generation_mode}，已降级到复制模式",
                    error_code="UNSUPPORTED_GENERATION_MODE",
                )
                content = DocumentServiceV2._generate_copy_mode(
                    content_template=template.content_template,
                    sources=template.sources,
                    source_data_map=source_data_map,
                )

            degraded = generation_error is not None

            summary_data = {
                "document_id": document_id,
                "title": template.title,
                "field_key": template.field_key,
                "content": content,
                "version": 1,
                "is_change": 0,
                "ai_generate": content if generation_mode == 1 and not degraded else None,
                "order_index": idx,
            }
            summary = DocumentSummary(**summary_data)
            db.add(summary)
            await db.flush()

            generated_summary_map[template.field_key] = content
            summary_id_map[template.field_key] = summary.summary_id

            if template.sources:
                await DocumentServiceV2._create_dependency_edges(
                    db=db,
                    source_id=summary.summary_id,
                    sources=template.sources,
                    core_info_id_map=core_info_id_map,
                    summary_id_map=summary_id_map,
                )

            created_items.append(
                {
                    "summary": summary,
                    "template_id": str(template.summary_template_id),
                    "generation_mode": generation_mode,
                    "sources": template.sources,
                    "degraded": degraded,
                    "generation_error": generation_error,
                }
            )

        await db.commit()
        return created_items

    @staticmethod
    async def apply_structure_template(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        structure_templates = await StructureTemplateMapper.get_by_template_id(
            db, document.template_id
        )

        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.title: item.core_info_id for item in core_info_list}

        existing_summaries = await SummaryMapper.get_summaries_by_document_id(
            db, document_id
        )
        summary_id_map = {item.field_key: item.summary_id for item in existing_summaries}

        structure_field_key_to_id = {
            tmpl.field_key: tmpl.structure_template_id for tmpl in structure_templates
        }

        template_id_map = {}
        created_chapters = []

        sorted_templates = sorted(
            structure_templates, key=lambda x: (x.level, x.order_index)
        )

        for template in sorted_templates:
            chapter = Chapter(
                document_id=document_id,
                parent_id=template_id_map.get(template.parent_id)
                if template.parent_id
                else None,
                title=template.title,
                status=0,
                order_index=template.order_index,
            )
            db.add(chapter)
            await db.flush()

            template_id_map[template.structure_template_id] = chapter.chapter_id
            generation_mode = template.generation_mode
            generation_error = None
            paragraph = None
            paragraph_content = ""

            if generation_mode in (0, 1):
                source_data_map = {}
                try:
                    source_data_map = await build_sources_data_map(
                        db=db,
                        document_id=str(document_id),
                        sources=template.sources or [],
                    )
                except Exception as exc:
                    generation_error = DocumentServiceV2._build_generation_error(
                        template_id=str(template.structure_template_id),
                        field_key=template.field_key,
                        generation_mode=generation_mode,
                        error_type=type(exc).__name__,
                        error_message=str(exc),
                    )

                if generation_mode == 1 and generation_error is None:
                    try:
                        paragraph_content = (
                            await DocumentServiceV2._generate_structure_ai_mode(
                                document=document,
                                template=template,
                                source_data_map=source_data_map,
                            )
                        )
                    except Exception as exc:
                        generation_error = DocumentServiceV2._build_generation_error(
                            template_id=str(template.structure_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type=type(exc).__name__,
                            error_message=str(exc),
                        )

                if not paragraph_content:
                    if generation_mode == 1 and generation_error is None:
                        generation_error = DocumentServiceV2._build_generation_error(
                            template_id=str(template.structure_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type="AIEmptyResponse",
                            error_message="AI返回为空，已降级到复制模式",
                            error_code="AI_EMPTY_RESPONSE",
                        )
                    paragraph_content = DocumentServiceV2._generate_copy_mode(
                        content_template=template.content_template,
                        sources=template.sources,
                        source_data_map=source_data_map,
                    )

                degraded = generation_error is not None

                if paragraph_content or generation_mode == 1:
                    paragraph = Paragraph(
                        chapter_id=chapter.chapter_id,
                        content=paragraph_content or "",
                        para_type="paragraph",
                        order_index=0,
                        ai_eval=None,
                        ai_suggestion=None,
                        ai_generate=paragraph_content
                        if generation_mode == 1 and not degraded
                        else None,
                        ischange=0,
                    )
                    db.add(paragraph)
                    await db.flush()

                    if template.sources:
                        await DocumentServiceV2._create_structure_dependency_edges(
                            db=db,
                            paragraph_id=paragraph.paragraph_id,
                            sources=template.sources,
                            core_info_id_map=core_info_id_map,
                            summary_id_map=summary_id_map,
                            structure_field_key_to_id=structure_field_key_to_id,
                            template_id_map=template_id_map,
                        )
            else:
                generation_error = DocumentServiceV2._build_generation_error(
                    template_id=str(template.structure_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type="UnsupportedGenerationMode",
                    error_message=f"不支持的generation_mode: {generation_mode}",
                    error_code="UNSUPPORTED_GENERATION_MODE",
                )

            created_chapters.append(
                {
                    "chapter": chapter,
                    "template_id": str(template.structure_template_id),
                    "generation_mode": generation_mode,
                    "content_template": template.content_template,
                    "sources": template.sources,
                    "default_prompt": template.default_prompt,
                    "custom_prompt": template.custom_prompt,
                    "degraded": generation_error is not None,
                    "generation_error": generation_error,
                    "paragraph": paragraph,
                    "paragraph_content": paragraph_content
                    if generation_mode == 1
                    else None,
                }
            )

        await db.commit()
        return created_chapters

    @staticmethod
    def _generate_copy_mode(
        content_template: str,
        sources: list,
        source_data_map: dict,
    ) -> str:
        if not content_template:
            return ""

        if not sources:
            return DocumentServiceV2._render_template_variables(
                content_template, source_data_map
            )

        variable_map = {}
        for source in sources:
            target_field = source.get("target_field")
            match_key = source.get("match_key")
            if not target_field:
                continue
            variable_map[target_field] = source_data_map.get(
                target_field, source_data_map.get(match_key, "")
            )

        merged_map = {**source_data_map, **variable_map}
        return DocumentServiceV2._render_template_variables(content_template, merged_map)

    @staticmethod
    async def _generate_ai_mode(
        document: Document,
        template: SummaryTemplate,
        source_data_map: Dict[str, Any],
    ) -> str:
        prompt_template = template.custom_prompt or template.default_prompt
        if not prompt_template:
            return ""

        sources_data_str = format_sources_data_for_prompt(source_data_map)

        prompt = format_summary_prompt(
            title=document.title,
            summary_type=template.title,
            purpose=document.purpose,
            sources_data=sources_data_str,
            custom_template=prompt_template,
        )

        llm_client = get_llm_client()
        result = await llm_client.call_ai(
            prompt=prompt,
            template_id=str(template.summary_template_id),
            field_key=template.field_key,
        )

        if result.get("error_code"):
            raise Exception(result.get("error_message", "AI 调用失败"))

        content = result.get("content", "")
        parsed = parse_summary_output(content)
        return parsed.get("content", content)

    @staticmethod
    async def _generate_structure_ai_mode(
        document: Document,
        template: StructureTemplate,
        source_data_map: Dict[str, Any],
    ) -> str:
        prompt_template = template.custom_prompt or template.default_prompt
        if not prompt_template:
            return ""

        sources_data_str = format_sources_data_for_prompt(source_data_map)

        prompt = format_structure_prompt(
            title=document.title,
            purpose=document.purpose,
            sources_data=sources_data_str,
            custom_template=prompt_template,
        )

        llm_client = get_llm_client()
        result = await llm_client.call_ai(
            prompt=prompt,
            template_id=str(template.structure_template_id),
            field_key=template.field_key,
        )

        if result.get("error_code"):
            raise Exception(result.get("error_message", "AI 调用失败"))

        content = result.get("content", "")
        return content.strip()

    @staticmethod
    async def _create_dependency_edges(
        db: AsyncSession,
        source_id: UUID,
        sources: list,
        core_info_id_map: Dict[str, UUID],
        summary_id_map: Dict[str, UUID],
    ):
        for src in sources:
            source_type = src.get("source")
            match_key = src.get("match_key")
            target_id = None
            target_type = None

            if source_type == "keyinfo":
                target_type = "document_entity"
                target_id = core_info_id_map.get(match_key)
            elif source_type == "summary":
                target_type = "summary"
                target_id = summary_id_map.get(match_key)
            elif source_type == "chapter":
                target_type = "chapter"

            if target_type and target_id:
                await DependencyService.create_dependency_edge(
                    db=db,
                    source_type="summary",
                    source_id=source_id,
                    target_type=target_type,
                    target_id=target_id,
                )

    @staticmethod
    async def _create_structure_dependency_edges(
        db: AsyncSession,
        paragraph_id: UUID,
        sources: list,
        core_info_id_map: Dict[str, UUID],
        summary_id_map: Dict[str, UUID],
        structure_field_key_to_id: Dict[str, UUID],
        template_id_map: Dict[UUID, UUID],
    ):
        for src in sources:
            source_obj = src.get("source")
            source_type = (
                source_obj.get("value") if isinstance(source_obj, dict) else source_obj
            )

            match_keys_data = src.get("match_keys")
            if not match_keys_data:
                old_match_key = src.get("match_key")
                match_keys = [{"value": old_match_key}] if old_match_key else []
            else:
                match_keys = match_keys_data

            for mk in match_keys:
                match_key = mk.get("value") if isinstance(mk, dict) else mk
                if not match_key:
                    continue

                target_id = None
                target_type = None

                if source_type == "keyinfo":
                    target_type = "document_entity"
                    target_id = core_info_id_map.get(match_key)
                elif source_type == "summary":
                    target_type = "summary"
                    target_id = summary_id_map.get(match_key)
                elif source_type == "chapter":
                    target_type = "chapter"
                    ref_template_id = structure_field_key_to_id.get(match_key)
                    if ref_template_id:
                        target_id = template_id_map.get(ref_template_id)

                if target_type and target_id:
                    await DependencyService.create_dependency_edge(
                        db=db,
                        source_type="paragraph",
                        source_id=paragraph_id,
                        target_type=target_type,
                        target_id=target_id,
                    )

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()

        core_info_templates = await db.execute(
            select(CoreInfoTemplate)
            .join(
                DocumentCoreInfo,
                CoreInfoTemplate.field_name == DocumentCoreInfo.title,
            )
            .where(DocumentCoreInfo.document_id == document_id)
        )
        templates = core_info_templates.scalars().all()

        template_map = {t.field_name: t.field_key for t in templates}

        core_info_map = {}
        for info in core_infos:
            field_key = template_map.get(info.title, info.title)
            core_info_map[field_key] = info.content

        return core_info_map

    @staticmethod
    async def get_template_info(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(
            db, document.template_id
        )
        summary_templates = await SummaryTemplateMapper.get_by_template_id(
            db, document.template_id
        )
        structure_tree = await DocumentServiceV2._get_structure_tree(
            db, document.template_id
        )

        return {
            "template_id": str(document.template_id),
            "core_info_templates": [
                {
                    "core_template_id": str(t.core_template_id),
                    "field_name": t.field_name,
                    "field_key": t.field_key,
                    "field_type": t.field_type,
                    "default_value": t.default_value,
                    "options": t.options,
                    "is_required": t.is_required,
                    "order_index": t.order_index,
                }
                for t in core_info_templates
            ],
            "summary_templates": [
                {
                    "summary_template_id": str(t.summary_template_id),
                    "title": t.title,
                    "field_key": t.field_key,
                    "generation_mode": t.generation_mode,
                    "content_template": t.content_template,
                    "sources": t.sources,
                    "default_prompt": t.default_prompt,
                    "custom_prompt": t.custom_prompt,
                    "order_index": t.order_index,
                }
                for t in summary_templates
            ],
            "structure_templates": structure_tree,
        }

    @staticmethod
    async def _get_structure_tree(db: AsyncSession, template_id: UUID) -> List[dict]:
        all_templates = await StructureTemplateMapper.get_by_template_id(db, template_id)

        def build_tree(parent_id=None):
            children = []
            for t in all_templates:
                if t.parent_id == parent_id:
                    node = {
                        "structure_template_id": str(t.structure_template_id),
                        "title": t.title,
                        "field_key": t.field_key,
                        "level": t.level,
                        "generation_mode": t.generation_mode,
                        "order_index": t.order_index,
                        "content_template": t.content_template,
                        "sources": t.sources,
                        "default_prompt": t.default_prompt,
                        "custom_prompt": t.custom_prompt,
                        "children": build_tree(t.structure_template_id),
                    }
                    children.append(node)
            children.sort(key=lambda x: x["order_index"])
            return children

        return build_tree()

    @staticmethod
    async def create_document_snapshot(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        document.snapshot_cursor += 1
        description = f"快照{document.snapshot_cursor}"

        chapters_result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id)
        )
        chapters = chapters_result.scalars().all()

        chapter_with_paragraphs = []
        for chapter in chapters:
            paragraphs_result = await db.execute(
                select(Paragraph)
                .where(Paragraph.chapter_id == chapter.chapter_id)
                .order_by(Paragraph.order_index)
            )
            paragraphs = paragraphs_result.scalars().all()
            chapter_with_paragraphs.append((chapter, paragraphs))

        snapshot_data = {
            "chapters": [
                {
                    "chapter_id": str(chapter.chapter_id),
                    "title": chapter.title,
                    "status": chapter.status,
                    "order_index": chapter.order_index,
                    "paragraphs": [
                        {
                            "paragraph_id": str(para.paragraph_id),
                            "content": para.content,
                            "para_type": para.para_type,
                            "order_index": para.order_index,
                            "ai_eval": para.ai_eval,
                            "ai_suggestion": para.ai_suggestion,
                            "ai_generate": para.ai_generate,
                            "ischange": para.ischange,
                        }
                        for para in paragraphs
                    ],
                }
                for chapter, paragraphs in chapter_with_paragraphs
            ]
        }

        new_snapshot = DocumentVersion(
            document_id=document_id,
            description=description,
            snapshot_data=snapshot_data,
            created_by=None,
        )

        new_snapshot = await DocumentMapper.create_snapshot(db, new_snapshot)

        result_data = {
            "version_id": new_snapshot.version_id,
            "document_id": new_snapshot.document_id,
            "description": new_snapshot.description,
            "snapshot_data": new_snapshot.snapshot_data,
            "created_at": new_snapshot.created_at,
            "created_by": new_snapshot.created_by,
        }

        return result_data

    @staticmethod
    async def update_snapshot(db: AsyncSession, snapshot_id: UUID, description: str):
        result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")

        await DocumentMapper.update_snapshot(db, snapshot_id, {"description": description})

        updated_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        updated_snapshot = updated_result.scalar_one_or_none()

        result_data = {
            "version_id": updated_snapshot.version_id,
            "document_id": updated_snapshot.document_id,
            "description": updated_snapshot.description,
            "snapshot_data": updated_snapshot.snapshot_data,
            "created_at": updated_snapshot.created_at,
            "created_by": updated_snapshot.created_by,
        }

        return result_data
