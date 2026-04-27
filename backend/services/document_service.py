from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.mappers.template_literature_mapper import TemplateLiteratureMapper
from db.models import Document, DocumentCoreInfo, Template, CoreInfoTemplate, SummaryTemplate, StructureTemplate, User
from schemas.document_schemas import DocumentCreate, DocumentUpdate, PaginationParams
from uuid import UUID, uuid4
from fastapi import HTTPException
from services.structure_template_service import StructureTemplateService
from core.constants import TemplateType


class DocumentService:

    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate, user_id=None):
        # 获取系统模板
        system_template = await TemplateMapper.get_template(db, doc_in.template_id)
        if not system_template:
            raise HTTPException(status_code=404, detail="模板不存在")

        # 1. 创建新模板 (主表浅拷贝，文档私有副本)
        new_template_obj = Template(
            group_id=system_template.group_id,
            purpose=system_template.purpose,
            display_name=system_template.display_name,
            content=system_template.content,
            version=1,
            template_type=TemplateType.DOCUMENT_PRIVATE,
            user_id=user_id,
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
                    order_index=old_struct.order_index,
                    paragraphs=old_struct.paragraphs,
                )
                new_structures.append(new_struct)

            await StructureTemplateMapper.batch_create(db, new_structures)

        # 5. 创建新文档，关联新创建的模板，写入 user_id
        new_document = Document(
            title=doc_in.title,
            purpose=doc_in.purpose,
            template_id=new_template.template_id,
            user_id=user_id,
        )

        created_document = await DocumentMapper.create_document(db, new_document)

        # 6. 将新文档的 ID 回填到模板的冗余字段 document_id 中
        new_template.document_id = created_document.document_id

        # 7. 拷贝原始模板的文献绑定关系到私有副本（只拷贝 public 文献）
        await TemplateLiteratureMapper.copy_bindings(
            db, system_template.template_id, new_template.template_id
        )

        await db.commit()
        await db.refresh(created_document)

        return created_document

    @staticmethod
    async def list_documents(
        db: AsyncSession,
        pagination: PaginationParams,
        user_id=None,
        keyword: str = None,
        filter_user_id=None,
        purpose: str = None,
    ):
        page = pagination.page
        page_size = pagination.page_size

        base_filter = []
        if user_id is not None:
            base_filter.append(Document.user_id == user_id)
        if filter_user_id is not None:
            base_filter.append(Document.user_id == filter_user_id)
        if keyword:
            base_filter.append(Document.title.ilike(f"%{keyword}%"))
        if purpose:
            base_filter.append(Document.purpose == purpose)

        count_query = select(func.count()).select_from(Document)
        for f in base_filter:
            count_query = count_query.where(f)
        total = (await db.execute(count_query)).scalar_one()

        query = (
            select(Document, Template.purpose, Template.display_name, User.name)
            .outerjoin(Template, Document.template_id == Template.template_id)
            .outerjoin(User, Document.user_id == User.user_id)
            .order_by(Document.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        for f in base_filter:
            query = query.where(f)

        rows = (await db.execute(query)).all()
        documents = [
            {"doc": row[0], "purpose": row[1], "display_name": row[2], "user_name": row[3]}
            for row in rows
        ]
        return total, documents

    @staticmethod
    async def get_document(db: AsyncSession, document_id: UUID, owner_id: UUID = None):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权访问此文档")
        template_name = None
        if document.template_id:
            result = await db.execute(
                select(Template.display_name).where(Template.template_id == document.template_id)
            )
            template_name = result.scalar()
        return document, template_name

    @staticmethod
    async def update_document(db: AsyncSession, document_id: UUID, doc_in: DocumentUpdate, owner_id: UUID = None):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权修改此文档")

        update_data = {}
        if doc_in.title is not None:
            update_data["title"] = doc_in.title
        if doc_in.purpose is not None:
            update_data["purpose"] = doc_in.purpose
        if doc_in.template_id is not None:
            update_data["template_id"] = doc_in.template_id

        await DocumentMapper.update_document(db, document_id, update_data)
        await db.commit()
        return await DocumentMapper.get_document_by_id(db, document_id)

    @staticmethod
    async def delete_document(db: AsyncSession, document_id: UUID, owner_id: UUID = None):
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权删除此文档")

        await DocumentMapper.delete_document(db, document)
        await db.commit()
        return {"message": "删除成功"}

    @staticmethod
    async def get_full_content(db: AsyncSession, document_id: UUID, owner_id: UUID = None):
        """
        获取文档全量内容：章节树 + 每个章节的段落
        两次查询解决 N+1：一次拉所有章节，一次拉所有段落
        """
        from db.mappers.chapter_mapper import ChapterMapper
        from db.mappers.paragraph_mapper import ParagraphMapper

        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权访问此文档")

        chapters = await ChapterMapper.get_chapters_by_document_id(db, document_id)
        paragraphs = await ParagraphMapper.get_paragraphs_by_document_id(db, document_id)

        para_map: dict = {}
        for p in paragraphs:
            para_map.setdefault(p.chapter_id, []).append(p)

        chapter_map = {c.chapter_id: c for c in chapters}

        def build_node(chapter):
            return {
                "chapter": chapter,
                "paragraphs": para_map.get(chapter.chapter_id, []),
                "children": [
                    build_node(chapter_map[c.chapter_id])
                    for c in chapters
                    if c.parent_id == chapter.chapter_id
                ],
            }

        tree = [
            build_node(c)
            for c in chapters
            if c.parent_id is None
        ]

        return document_id, tree

    @staticmethod
    async def get_citations(db: AsyncSession, document_id: UUID, owner_id: UUID = None) -> list:
        """获取文档引用文献列表（去重，按编号排序）"""
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权访问此文档")
        from db.mappers.document_citation_mapper import DocumentCitationMapper
        return await DocumentCitationMapper.get_distinct_by_document_id(db, document_id)
        """获取文档核心信息的键值对映射，key 为 field_key，value 为 content"""
        result = await db.execute(
            select(DocumentCoreInfo).where(DocumentCoreInfo.document_id == document_id)
        )
        core_infos = result.scalars().all()
        return {info.field_key: info.content for info in core_infos if info.field_key}

    @staticmethod
    async def get_template_info(db: AsyncSession, document_id: UUID, owner_id: UUID = None):
        """
        获取文档关联的模板完整信息（包含核心信息模板、摘要模板、结构模板）
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if owner_id is not None and str(document.user_id) != str(owner_id):
            raise HTTPException(status_code=403, detail="无权访问此文档")

        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, document.template_id)
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, document.template_id)
        structure_tree = await StructureTemplateService.get_structure_tree(db, document.template_id)

        return {
            "template_id": str(document.template_id),
            "core_info_templates": [
                {
                    "core_template_id": str(t.core_template_id),
                    "template_id": str(document.template_id),
                    "parent_id": str(t.parent_id) if t.parent_id else None,
                    "field_name": t.field_name,
                    "field_key": t.field_key,
                    "field_type": t.field_type,
                    "default_value": t.default_value,
                    "options": t.options,
                    "is_required": t.is_required,
                    "order_index": t.order_index,
                    "created_at": t.created_at,
                    "updated_at": t.updated_at,
                }
                for t in core_info_templates
            ],
            "summary_templates": [
                {
                    "summary_template_id": str(t.summary_template_id),
                    "template_id": str(document.template_id),
                    "title": t.title,
                    "field_key": t.field_key,
                    "generation_mode": t.generation_mode,
                    "content_template": t.content_template,
                    "sources": t.sources,
                    "default_prompt": t.default_prompt,
                    "custom_prompt": t.custom_prompt,
                    "order_index": t.order_index,
                    "created_at": t.created_at,
                    "updated_at": t.updated_at,
                }
                for t in summary_templates
            ],
            "structure_templates": structure_tree
        }

    @staticmethod
    async def export_template(db: AsyncSession, document_id: UUID, user_id: UUID, display_name: str = None):
        """
        将文档的私有模板副本导出到用户个人模板库。
        深拷贝主表 + 三类子模板，新记录 template_type=USER_REUSABLE，user_id=当前用户，document_id=null。
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if str(document.user_id) != str(user_id):
            raise HTTPException(status_code=403, detail="无权操作此文档")
        if not document.template_id:
            raise HTTPException(status_code=400, detail="文档未关联模板")

        source = await TemplateMapper.get_template(db, document.template_id)
        if not source:
            raise HTTPException(status_code=404, detail="模板不存在")

        # 1. 创建新模板主表（归属当前用户，不绑定文档，类型为用户可复用私有模板）
        # document_id=None：此模板归属用户个人库，不绑定任何文档（nullable 外键）
        new_template = Template(
            group_id=source.group_id,
            purpose=source.purpose,
            display_name=display_name or source.display_name,
            content=source.content,
            version=1,
            template_type=TemplateType.USER_REUSABLE,
            user_id=user_id,
            document_id=None,
            is_active=True,
        )
        new_template = await TemplateMapper.create_template(db, new_template)

        # 2. 深拷贝 CoreInfoTemplate
        old_core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, source.template_id)
        if old_core_infos:
            id_mapping = {}
            for ci in old_core_infos:
                id_mapping[ci.core_template_id] = uuid4()

            def get_level(ci):
                level = 0
                curr = ci
                while curr.parent_id:
                    level += 1
                    curr = next((x for x in old_core_infos if x.core_template_id == curr.parent_id), None)
                    if not curr:
                        break
                return level

            for ci in sorted(old_core_infos, key=get_level):
                db.add(CoreInfoTemplate(
                    core_template_id=id_mapping[ci.core_template_id],
                    template_id=new_template.template_id,
                    parent_id=id_mapping.get(ci.parent_id) if ci.parent_id else None,
                    field_name=ci.field_name,
                    field_key=ci.field_key,
                    field_type=ci.field_type,
                    default_value=ci.default_value,
                    options=ci.options,
                    is_required=ci.is_required,
                    order_index=ci.order_index,
                ))

        # 3. 深拷贝 SummaryTemplate
        old_summaries = await SummaryTemplateMapper.get_by_template_id(db, source.template_id)
        if old_summaries:
            for s in old_summaries:
                db.add(SummaryTemplate(
                    template_id=new_template.template_id,
                    field_key=s.field_key,
                    title=s.title,
                    generation_mode=s.generation_mode,
                    content_template=s.content_template,
                    sources=s.sources,
                    default_prompt=s.default_prompt,
                    custom_prompt=s.custom_prompt,
                    order_index=s.order_index,
                ))

        # 4. 深拷贝 StructureTemplate
        old_structures = await StructureTemplateMapper.get_by_template_id(db, source.template_id)
        if old_structures:
            id_mapping = {}
            for st in sorted(old_structures, key=lambda x: x.level):
                new_id = uuid4()
                id_mapping[st.structure_template_id] = new_id
                db.add(StructureTemplate(
                    structure_template_id=new_id,
                    template_id=new_template.template_id,
                    parent_id=id_mapping.get(st.parent_id) if st.parent_id else None,
                    field_key=st.field_key,
                    title=st.title,
                    level=st.level,
                    order_index=st.order_index,
                    paragraphs=st.paragraphs,
                ))

        # 5. 拷贝文献绑定关系（包括 public 和用户自己的 private 文献）
        await TemplateLiteratureMapper.copy_bindings(
            db, source.template_id, new_template.template_id
        )

        await db.commit()
        await db.refresh(new_template)
        return new_template

    @staticmethod
    async def sync_template(db: AsyncSession, document_id: UUID, user_id: UUID) -> Template:
        """
        将文档的 type=0 私有副本同步到原始模板（type=1/2）的最新版本。

        同步内容：
        1. 清空私有副本的三类子模板，从原始模板深拷贝
        2. 清空私有副本的 public 文献绑定，从原始模板拷贝
        3. 保留用户自己绑定的 private 文献（user_id=当前用户的不删）
        """
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        if str(document.user_id) != str(user_id):
            raise HTTPException(status_code=403, detail="无权操作此文档")
        if not document.template_id:
            raise HTTPException(status_code=400, detail="文档未关联模板")

        private_tpl = await TemplateMapper.get_template(db, document.template_id)
        if not private_tpl:
            raise HTTPException(status_code=404, detail="文档模板不存在")

        # 找到同 group_id 的原始模板（type=1 优先，其次 type=2）
        from sqlalchemy.future import select as sa_select
        result = await db.execute(
            sa_select(Template)
            .where(
                Template.group_id == private_tpl.group_id,
                Template.template_type.in_([TemplateType.SYSTEM, TemplateType.USER_REUSABLE]),
            )
            .order_by(Template.template_type.asc())  # type=1 排在 type=2 前面
            .limit(1)
        )
        source = result.scalar_one_or_none()
        if not source:
            raise HTTPException(status_code=404, detail="找不到原始模板，无法同步")

        # ── 1. 同步三类子模板 ──

        await CoreInfoTemplateMapper.delete_by_template_id(db, private_tpl.template_id)
        await SummaryTemplateMapper.delete_by_template_id(db, private_tpl.template_id)
        await StructureTemplateMapper.delete_by_template_id(db, private_tpl.template_id)

        old_core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, source.template_id)
        if old_core_infos:
            id_mapping = {}
            for ci in old_core_infos:
                id_mapping[ci.core_template_id] = uuid4()

            def get_level(ci):
                level = 0
                curr = ci
                while curr.parent_id:
                    level += 1
                    curr = next((x for x in old_core_infos if x.core_template_id == curr.parent_id), None)
                    if not curr:
                        break
                return level

            for ci in sorted(old_core_infos, key=get_level):
                db.add(CoreInfoTemplate(
                    core_template_id=id_mapping[ci.core_template_id],
                    template_id=private_tpl.template_id,
                    parent_id=id_mapping.get(ci.parent_id) if ci.parent_id else None,
                    field_name=ci.field_name,
                    field_key=ci.field_key,
                    field_type=ci.field_type,
                    default_value=ci.default_value,
                    options=ci.options,
                    is_required=ci.is_required,
                    order_index=ci.order_index,
                ))

        old_summaries = await SummaryTemplateMapper.get_by_template_id(db, source.template_id)
        if old_summaries:
            for s in old_summaries:
                db.add(SummaryTemplate(
                    template_id=private_tpl.template_id,
                    field_key=s.field_key,
                    title=s.title,
                    generation_mode=s.generation_mode,
                    content_template=s.content_template,
                    sources=s.sources,
                    default_prompt=s.default_prompt,
                    custom_prompt=s.custom_prompt,
                    order_index=s.order_index,
                ))

        old_structures = await StructureTemplateMapper.get_by_template_id(db, source.template_id)
        if old_structures:
            id_mapping = {}
            for st in sorted(old_structures, key=lambda x: x.level):
                new_id = uuid4()
                id_mapping[st.structure_template_id] = new_id
                db.add(StructureTemplate(
                    structure_template_id=new_id,
                    template_id=private_tpl.template_id,
                    parent_id=id_mapping.get(st.parent_id) if st.parent_id else None,
                    field_key=st.field_key,
                    title=st.title,
                    level=st.level,
                    order_index=st.order_index,
                    paragraphs=st.paragraphs,
                ))

        # ── 2. 同步文献绑定关系 ──
        # 清空私有副本的 public 文献绑定，保留用户自己的 private 文献绑定
        await TemplateLiteratureMapper.delete_public_by_template_id(
            db, private_tpl.template_id, user_id
        )
        # 从原始模板拷贝文献绑定关系（只拷贝 public 文献，private 文献不跨用户传播）
        from db.models import Literature
        source_lit_ids = await TemplateLiteratureMapper.list_literature_ids_by_template_id(
            db, source.template_id
        )
        for lit_id in source_lit_ids:
            lit_result = await db.execute(
                sa_select(Literature).where(Literature.literature_id == lit_id)
            )
            lit = lit_result.scalar_one_or_none()
            if lit and lit.scope == "public":
                await TemplateLiteratureMapper.bind(db, private_tpl.template_id, lit_id)

        # 同步主表字段
        private_tpl.purpose = source.purpose
        private_tpl.display_name = source.display_name
        private_tpl.content = source.content

        await db.commit()
        await db.refresh(private_tpl)
        return private_tpl
