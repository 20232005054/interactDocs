from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.mappers.summary_mapper import SummaryMapper
from db.models import Document,Chapter,Paragraph,DocumentVersion,Template,CoreInfoTemplate,SummaryTemplate,StructureTemplate,DocumentCoreInfo,DocumentSummary
from schemas.schemas import DocumentCreate, DocumentUpdate, PaginationParams
from uuid import UUID, uuid4
from fastapi import HTTPException
from services.dependency_service import DependencyService
from services.summary_template_service import SummaryTemplateService
from services.structure_template_service import StructureTemplateService
from services.ai_client import AIClientError
from core.constants import EdgeSourceType, EdgeTargetType

class DocumentService:
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
    def _extract_ai_error_fields(exc: Exception):
        if isinstance(exc, AIClientError):
            return exc.error_code, exc.duration_ms
        return None, None

    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate):
        # 获取系统模板
        system_template = await TemplateMapper.get_template(db, doc_in.template_id)
        if not system_template:
            raise HTTPException(status_code=404, detail="模板不存在")
        
        # 1. 创建新模板 (主表浅拷贝)
        new_template_obj = Template(
            group_id=system_template.group_id,
            purpose=system_template.purpose,
            display_name=system_template.display_name,
            content=system_template.content,
            version=1,
            is_system=False,
            user_id=None,
            is_active=True
        )
        new_template = await TemplateMapper.create_template(db, new_template_obj)
        
        # 2. 深拷贝 CoreInfoTemplate
        old_core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, system_template.template_id)
        if old_core_infos:
            id_mapping = {}
            for old_ci in old_core_infos:
                id_mapping[old_ci.core_template_id] = uuid4()
                
            def get_level(ci):
                level = 0
                curr = ci
                while curr.parent_id:
                    level += 1
                    curr = next((x for x in old_core_infos if x.core_template_id == curr.parent_id), None)
                    if not curr:
                        break
                return level
            
            old_core_infos_sorted = sorted(old_core_infos, key=get_level)
            
            new_core_infos = []
            for old_ci in old_core_infos_sorted:
                new_ci = CoreInfoTemplate(
                    core_template_id=id_mapping[old_ci.core_template_id],
                    template_id=new_template.template_id,
                    parent_id=id_mapping.get(old_ci.parent_id) if old_ci.parent_id else None,
                    field_name=old_ci.field_name,
                    field_key=old_ci.field_key,
                    field_type=old_ci.field_type,
                    default_value=old_ci.default_value,
                    options=old_ci.options,
                    is_required=old_ci.is_required,
                    order_index=old_ci.order_index
                )
                new_core_infos.append(new_ci)
            await CoreInfoTemplateMapper.batch_create(db, new_core_infos)

        # 3. 深拷贝 SummaryTemplate
        old_summaries = await SummaryTemplateMapper.get_by_template_id(db, system_template.template_id)
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
                    order_index=old_sum.order_index
                )
                new_summaries.append(new_sum)
            await SummaryTemplateMapper.batch_create(db, new_summaries)

        # 4. 深拷贝 StructureTemplate (使用排序+哈希表映射算法处理树形结构)
        old_structures = await StructureTemplateMapper.get_by_template_id(db, system_template.template_id)
        if old_structures:
            # 按层级排序，确保父节点先于子节点处理
            sorted_old_structures = sorted(old_structures, key=lambda x: x.level)
            
            id_mapping = {}  # 用于记录 旧structure_template_id -> 新structure_template_id
            new_structures = []
            
            for old_struct in sorted_old_structures:
                new_struct_id = uuid4()
                id_mapping[old_struct.structure_template_id] = new_struct_id
                
                # 确定新的 parent_id
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
                    order_index=old_struct.order_index
                )
                new_structures.append(new_struct)
            
            await StructureTemplateMapper.batch_create(db, new_structures)
        
        # 5. 创建新文档，关联新创建的模板
        new_document = Document(
            title=doc_in.title,
            purpose=doc_in.purpose,
            template_id=new_template.template_id
        )
        
        created_document = await DocumentMapper.create_document(db, new_document)
        
        # 6. 将新文档的 ID 回填到模板的冗余字段 document_id 中
        new_template.document_id = created_document.document_id
        await db.commit()
        await db.refresh(created_document)
        
        return created_document

    @staticmethod
    async def list_documents(db: AsyncSession, pagination: PaginationParams):
        page = pagination.page
        page_size = pagination.page_size
        # 查询文档总数
        count_result = await db.execute(select(func.count()).select_from(Document))
        total = count_result.scalar_one()
        
        # 分页查询文档，同时 join 模板获取 purpose 和 display_name
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document, Template.purpose, Template.display_name)
            .outerjoin(Template, Document.template_id == Template.template_id)
            .order_by(Document.updated_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows = result.all()
        
        # 将结果组装为 (document, purpose, display_name) 元组列表
        documents = [
            {"doc": row[0], "purpose": row[1], "display_name": row[2]}
            for row in rows
        ]
        
        return total, documents

    @staticmethod
    async def get_document(db: AsyncSession, document_id: UUID):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        # 查模板名
        template_name = None
        if document.template_id:
            result = await db.execute(
                select(Template.display_name).where(Template.template_id == document.template_id)
            )
            template_name = result.scalar()
        return document, template_name

    @staticmethod
    async def update_document(db: AsyncSession, document_id: UUID, doc_in: DocumentUpdate):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 构建更新数据
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
        """获取文档快照列表"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取快照列表
        snapshots = await DocumentMapper.get_snapshots_by_document_id(db, document_id)
        
        # 构建返回数据
        snapshot_list = []
        for snapshot in snapshots:
            snapshot_list.append({
                "version_id": snapshot.version_id,
                "document_id": snapshot.document_id,
                "description": snapshot.description,
                "snapshot_data": snapshot.snapshot_data,
                "created_at": snapshot.created_at,
                "created_by": snapshot.created_by
            })
        
        return snapshot_list
    
    @staticmethod
    async def get_snapshot_detail(db: AsyncSession, document_id: UUID, snapshot_id: UUID):
        """获取快照详情"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取快照详情
        snapshot = await DocumentMapper.get_snapshot_by_id(db, snapshot_id, document_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")
        
        # 确保章节的内容都是正确格式
        if "chapters" in snapshot.snapshot_data:
            for chapter in snapshot.snapshot_data["chapters"]:
                if "paragraphs" not in chapter:
                    chapter["paragraphs"] = []
        
        # 构建返回数据
        result_data = {
            "version_id": snapshot.version_id,
            "document_id": snapshot.document_id,
            "description": snapshot.description,
            "snapshot_data": snapshot.snapshot_data,
            "created_at": snapshot.created_at,
            "created_by": snapshot.created_by
        }
        
        return result_data

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
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)

        # 预加载 core_info 和 summaries，用于解决 N+1 查询问题和依赖边创建
        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.field_key: item.core_info_id for item in core_info_list if item.field_key}
        
        # 建立已存在摘要的字典，用于后续模板引用或建边
        existing_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        # title 对应 field_key
        summary_id_map = {item.title: item.summary_id for item in existing_summaries}
        existing_summaries_map = {item.title: item.content for item in existing_summaries}

        created_items = []
        generated_summary_map = {}
        for idx, template in enumerate(summary_templates):
            content = ""
            generation_mode = template.generation_mode
            generation_error = None
            source_data_map = {}
            
            # 获取当前所有摘要（含本轮已生成）用于 sources 组装
            current_summaries_map = {**existing_summaries_map, **generated_summary_map}
            try:
                source_data_map = await SummaryTemplateService.build_sources_data_map(
                    db=db,
                    document=document,
                    sources=template.sources or [],
                    generated_summary_map=current_summaries_map,
                )
            except Exception as exc:
                error_code, duration_ms = DocumentService._extract_ai_error_fields(exc)
                generation_error = DocumentService._build_generation_error(
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
            elif generation_mode == 1:
                if generation_error is None:
                    try:
                        content = await SummaryTemplateService.render_ai_content(
                            db=db,
                            document=document,
                            summary_template=template,
                            generated_summary_map=current_summaries_map,
                            source_data_map=source_data_map,
                        )
                    except Exception as exc:
                        error_code, duration_ms = DocumentService._extract_ai_error_fields(exc)
                        generation_error = DocumentService._build_generation_error(
                            template_id=str(template.summary_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type=type(exc).__name__,
                            error_message=str(exc),
                            error_code=error_code,
                            duration_ms=duration_ms,
                        )

                if not content:
                    if generation_error is None:
                        generation_error = DocumentService._build_generation_error(
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
            else:
                generation_error = DocumentService._build_generation_error(
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
            # 创建摘要记录
            summary_data = {
                "document_id": document_id,
                "title": template.title, # title 存储显示标题
                "field_key": template.field_key, # field_key 存储业务唯一标识
                "content": content,
                "version": 1,
                "is_change": 0,
                "ai_generate": content if generation_mode == 1 and not degraded else None,
                "order_index": idx
            }
            summary = DocumentSummary(**summary_data)
            db.add(summary)
            await db.flush()  # 获取 summary.summary_id
            
            # 更新本轮生成的摘要字典（供后续模板引用和建边）
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
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        structure_templates = await StructureTemplateMapper.get_by_template_id(db, document.template_id)
        
        # 预加载 core_info 和 summaries
        core_info_list = await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        core_info_id_map = {item.field_key: item.core_info_id for item in core_info_list if item.field_key}
        
        existing_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        # 依赖建边和变量替换都依赖于 field_key，所以这里使用 field_key 作为映射键
        summary_id_map = {item.field_key: item.summary_id for item in existing_summaries}

        # 构建 structure_template 的 field_key 到 template_id 的映射，用于解析 chapter 依赖
        structure_field_key_to_id = {tmpl.field_key: tmpl.structure_template_id for tmpl in structure_templates}

        template_id_map = {}
        created_chapters = []
        
        sorted_templates = sorted(structure_templates, key=lambda x: (x.level, x.order_index))
        
        for template in sorted_templates:
            chapter = Chapter(
                document_id=document_id,
                parent_id=template_id_map.get(template.parent_id) if template.parent_id else None,
                title=template.title,
                field_key=template.field_key,
                status=0,
                order_index=template.order_index
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
                    source_data_map = await StructureTemplateService.build_sources_data_map(
                        db=db,
                        document=document,
                        sources=template.sources or []
                    )
                except Exception as exc:
                    error_code, duration_ms = DocumentService._extract_ai_error_fields(exc)
                    generation_error = DocumentService._build_generation_error(
                        template_id=str(template.structure_template_id),
                        field_key=template.field_key,
                        generation_mode=generation_mode,
                        error_type=type(exc).__name__,
                        error_message=str(exc),
                        error_code=error_code,
                        duration_ms=duration_ms,
                    )
                
                if generation_mode == 1 and generation_error is None:
                    try:
                        paragraph_content = await StructureTemplateService.render_ai_content(
                            db=db,
                            document=document,
                            structure_template=template,
                            source_data_map=source_data_map,
                        )
                    except Exception as exc:
                        error_code, duration_ms = DocumentService._extract_ai_error_fields(exc)
                        generation_error = DocumentService._build_generation_error(
                            template_id=str(template.structure_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type=type(exc).__name__,
                            error_message=str(exc),
                            error_code=error_code,
                            duration_ms=duration_ms,
                        )

                if not paragraph_content:
                    if generation_mode == 1 and generation_error is None:
                        generation_error = DocumentService._build_generation_error(
                            template_id=str(template.structure_template_id),
                            field_key=template.field_key,
                            generation_mode=generation_mode,
                            error_type="AIEmptyResponse",
                            error_message="AI返回为空，已降级到复制模式",
                            error_code="AI_EMPTY_RESPONSE",
                        )
                    paragraph_content = SummaryTemplateService.generate_content_copy_mode(
                        template.content_template, template.sources, source_data_map
                    )

                degraded = generation_error is not None
                
                # 只有当生成的内容不为空，或者原本就是AI生成模式时，才创建段落
                if paragraph_content or generation_mode == 1:
                    paragraph = Paragraph(
                        chapter_id=chapter.chapter_id,
                        content=paragraph_content or "",
                        para_type="paragraph",
                        order_index=0,
                        ai_eval=None,
                        ai_suggestion=None,
                        ai_generate=paragraph_content if generation_mode == 1 and not degraded else None,
                        ischange=0,
                    )
                    db.add(paragraph)
                    await db.flush()

                    # 建立依赖边（章节级别）
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
                                        document_id=document_id
                                    )
            else:
                generation_error = DocumentService._build_generation_error(
                    template_id=str(template.structure_template_id),
                    field_key=template.field_key,
                    generation_mode=generation_mode,
                    error_type="UnsupportedGenerationMode",
                    error_message=f"不支持的generation_mode: {generation_mode}",
                    error_code="UNSUPPORTED_GENERATION_MODE",
                )
            
            created_chapters.append({
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
                "paragraph_content": paragraph_content if generation_mode == 1 else None,
            })
        
        await db.commit()
        return created_chapters

    @staticmethod
    async def _get_core_info_map(db: AsyncSession, document_id: UUID) -> dict:
        """获取文档核心信息的键值对映射，key 为 field_key，value 为 content"""
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()
        return {info.field_key: info.content for info in core_infos if info.field_key}

    @staticmethod
    async def get_template_info(db: AsyncSession, document_id: UUID):
        """
        获取文档关联的模板完整信息（包含核心信息模板、摘要模板、结构模板）
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, document.template_id)
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
        structure_tree = await StructureTemplateService.get_structure_tree(db, document.template_id)
        
        return {
            "template_id": str(document.template_id),
            "core_info_templates": [
                {
                    "core_template_id": str(t.core_template_id),
                    "parent_id": str(t.parent_id) if t.parent_id else None,
                    "field_name": t.field_name,
                    "field_key": t.field_key,
                    "field_type": t.field_type,
                    "default_value": t.default_value,
                    "options": t.options,
                    "is_required": t.is_required,
                    "order_index": t.order_index
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
                    "order_index": t.order_index
                }
                for t in summary_templates
            ],
            "structure_templates": structure_tree
        }
    
    @staticmethod
    async def create_document_snapshot(db: AsyncSession, document_id: UUID):
        """创建文档快照"""
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 直接使用默认快照名格式
        document.snapshot_cursor += 1
        description = f"快照{document.snapshot_cursor}"
        
        # 获取文档的所有章节
        chapters_result = await db.execute(
            select(Chapter).where(Chapter.document_id == document_id)
        )
        chapters = chapters_result.scalars().all()
        
        # 获取每个章节的段落信息
        
        chapter_with_paragraphs = []
        for chapter in chapters:
            paragraphs_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = paragraphs_result.scalars().all()
            chapter_with_paragraphs.append((chapter, paragraphs))
        
        # 构建快照数据，只存储章节和段落信息
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
                            "ischange": para.ischange
                        }
                        for para in paragraphs
                    ]
                }
                for chapter, paragraphs in chapter_with_paragraphs
            ]
        }
        
        # 创建快照
       
        new_snapshot = DocumentVersion(
            document_id=document_id,
            description=description,
            snapshot_data=snapshot_data,
            created_by=None  # 临时设置为None，实际项目中应该从JWT中获取用户ID
        )
        
        # 保存快照
        new_snapshot = await DocumentMapper.create_snapshot(db, new_snapshot)
        
        # 构建返回数据
        result_data = {
            "version_id": new_snapshot.version_id,
            "document_id": new_snapshot.document_id,
            "description": new_snapshot.description,
            "snapshot_data": new_snapshot.snapshot_data,
            "created_at": new_snapshot.created_at,
            "created_by": new_snapshot.created_by
        }
        
        return result_data
    
    @staticmethod
    async def update_snapshot(db: AsyncSession, snapshot_id: UUID, description: str):
        """更新快照信息"""
        # 检查快照是否存在
        
        result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise HTTPException(status_code=404, detail="快照不存在")
        
        # 更新快照描述
        await DocumentMapper.update_snapshot(db, snapshot_id, {"description": description})
        
        # 获取更新后的快照
        updated_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.version_id == snapshot_id)
        )
        updated_snapshot = updated_result.scalar_one_or_none()
        
        # 构建返回数据
        result_data = {
            "version_id": updated_snapshot.version_id,
            "document_id": updated_snapshot.document_id,
            "description": updated_snapshot.description,
            "snapshot_data": updated_snapshot.snapshot_data,
            "created_at": updated_snapshot.created_at,
            "created_by": updated_snapshot.created_by
        }
        
        return result_data
