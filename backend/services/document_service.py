from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.mappers.document_mapper import DocumentMapper
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.models import Document, DocumentCoreInfo, Template, CoreInfoTemplate, SummaryTemplate, StructureTemplate
from schemas.schemas import DocumentCreate, DocumentUpdate, PaginationParams
from uuid import UUID, uuid4
from fastapi import HTTPException
from services.structure_template_service import StructureTemplateService


class DocumentService:

    @staticmethod
    async def create_document(db: AsyncSession, doc_in: DocumentCreate, user_id=None):
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
                    order_index=old_struct.order_index
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
        await db.commit()
        await db.refresh(created_document)

        return created_document

    @staticmethod
    async def list_documents(db: AsyncSession, pagination: PaginationParams, user_id=None):
        page = pagination.page
        page_size = pagination.page_size
        count_query = select(func.count()).select_from(Document)
        if user_id is not None:
            count_query = count_query.where(Document.user_id == user_id)
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        query = (
            select(Document, Template.purpose, Template.display_name)
            .outerjoin(Template, Document.template_id == Template.template_id)
            .order_by(Document.updated_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        if user_id is not None:
            query = query.where(Document.user_id == user_id)
        result = await db.execute(query)
        rows = result.all()

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
    async def get_full_content(db: AsyncSession, document_id: UUID):
        """
        获取文档全量内容：章节树 + 每个章节的段落
        两次查询解决 N+1：一次拉所有章节，一次拉所有段落
        """
        from db.mappers.chapter_mapper import ChapterMapper
        from db.mappers.paragraph_mapper import ParagraphMapper

        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

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
