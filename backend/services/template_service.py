from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID, uuid4
from db.models import Template
from db.mappers.template_mapper import TemplateMapper
from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
from db.mappers.summary_template_mapper import SummaryTemplateMapper
from db.mappers.structure_template_mapper import StructureTemplateMapper
from db.models import Template, CoreInfoTemplate, SummaryTemplate, StructureTemplate
from core.constants import TemplateType

class TemplateService:
    @staticmethod
    async def create_template(db: AsyncSession, purpose: str, display_name: str, content: dict, template_type: int = TemplateType.SYSTEM, user_id: UUID = None, group_id: UUID = None):
        """
        创建模板
        """
        # 如果没有指定group_id，则生成新的
        if not group_id:
            group_id = uuid4()
        new_template = Template(
            group_id=group_id,
            purpose=purpose,
            display_name=display_name,
            content=content,
            version=1,
            template_type=template_type,
            user_id=user_id,
            is_active=True
        )
        result = await TemplateMapper.create_template(db, new_template)
        await db.commit()
        return result
    
    @staticmethod
    async def get_template(db: AsyncSession, template_id: UUID):
        """
        获取模板详情
        """
        return await TemplateMapper.get_template(db, template_id)
    
    @staticmethod
    async def list_templates(
        db: AsyncSession,
        purpose: str = None,
        template_type: int = None,
        is_active: bool = None,
        keyword: str = None,
        page: int = 1,
        page_size: int = 20,
    ):
        """
        获取模板列表（支持分页和关键词搜索）
        """
        return await TemplateMapper.list_templates(db, purpose, template_type, is_active, keyword, page, page_size)
    
    @staticmethod
    async def get_distinct_purposes(db: AsyncSession, template_type: int = TemplateType.SYSTEM):
        """
        获取所有不同的用途
        """
        return await TemplateMapper.get_distinct_purposes(db, template_type)
    
   
    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, **kwargs):
        """
        更新模板。
        所有字段（含 content）均原地更新，version 在 content 变化时自增。
        不再新建行，子表不受影响。
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return None

        if 'content' in kwargs:
            template.version = (template.version or 0) + 1

        for key, value in kwargs.items():
            if hasattr(template, key):
                setattr(template, key, value)

        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def delete_template(db: AsyncSession, template_id: UUID):
        """
        删除模板
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return False
        
        await db.delete(template)
        await db.commit()
        return True
    
    @staticmethod
    async def update_template_content(db: AsyncSession, template_id: UUID, content: dict):
        """
        用户更新模板（仅修改content字段，不更新版本）
        """
        template = await TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        # 直接更新content字段
        template.content = content
        
        await db.commit()
        await db.refresh(template)
        return template
    
    @staticmethod
    async def list_templates_for_user(
        db: AsyncSession,
        user_id: UUID,
        purpose: str = None,
        is_active: bool = None,
        keyword: str = None,
        page: int = 1,
        page_size: int = 20,
    ):
        """
        返回系统模板 + 当前用户个人模板库（document_id IS NULL）的合并列表
        """
        from sqlalchemy import func, or_, and_

        base_filter = or_(
            and_(Template.template_type == TemplateType.SYSTEM, Template.is_active == True),
            and_(Template.template_type == TemplateType.USER_REUSABLE, Template.user_id == user_id, Template.is_active == True),
        )

        query = select(Template).where(base_filter).order_by(Template.template_type.asc(), Template.updated_at.desc())

        if purpose:
            query = query.where(Template.purpose == purpose)
        if is_active is not None:
            # 已在 base_filter 里限定了 is_active=True，此处可额外过滤
            query = query.where(Template.is_active == is_active)
        if keyword:
            query = query.where(Template.display_name.ilike(f"%{keyword}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        return result.scalars().all(), total

    @staticmethod
    async def get_templates_by_purpose(db: AsyncSession, purpose: str, template_type: int = None, is_active: bool = None):
        """
        根据用途获取模板列表
        """
        return await TemplateMapper.get_templates_by_purpose(db, purpose, template_type, is_active)

    @staticmethod
    async def get_template_versions(db: AsyncSession, template_id: UUID):
        """
        获取指定模板所在 group 的所有历史版本，按版本号升序。
        """
        from fastapi import HTTPException
        template = await TemplateMapper.get_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")
        return await TemplateMapper.get_versions_by_group_id(db, template.group_id)

    @staticmethod
    async def get_template_preview(db: AsyncSession, template_id: UUID):
        """
        获取模板完整预览信息（核心信息模板树 + 摘要模板列表 + 结构模板树）。
        用于用户创建文档前预览模板内容。
        """
        from fastapi import HTTPException
        from db.mappers.core_info_template_mapper import CoreInfoTemplateMapper
        from db.mappers.summary_template_mapper import SummaryTemplateMapper
        from services.structure_template_service import StructureTemplateService
        from schemas.response_schemas import (
            TemplateInfoResponse, CoreInfoTemplateResponse, SummaryTemplateResponse
        )

        template = await TemplateMapper.get_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")

        core_info_templates = await CoreInfoTemplateMapper.get_by_template_id(db, template_id)
        summary_templates = await SummaryTemplateMapper.get_by_template_id(db, template_id)
        structure_tree = await StructureTemplateService.get_structure_tree(db, template_id)

        def build_ci_node(items, parent_id=None):
            nodes = []
            for t in sorted([x for x in items if x.parent_id == parent_id], key=lambda x: x.order_index):
                nodes.append(CoreInfoTemplateResponse(
                    core_template_id=t.core_template_id,
                    template_id=t.template_id,
                    parent_id=t.parent_id,
                    field_name=t.field_name,
                    field_key=t.field_key,
                    field_type=t.field_type,
                    default_value=t.default_value,
                    options=t.options,
                    is_required=t.is_required,
                    order_index=t.order_index,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                    children=build_ci_node(items, t.core_template_id),
                ))
            return nodes

        return TemplateInfoResponse(
            template_id=template_id,
            core_info_templates=build_ci_node(core_info_templates),
            summary_templates=[
                SummaryTemplateResponse(
                    summary_template_id=t.summary_template_id,
                    template_id=t.template_id,
                    title=t.title,
                    field_key=t.field_key,
                    generation_mode=t.generation_mode,
                    content_template=t.content_template,
                    sources=t.sources,
                    default_prompt=t.default_prompt,
                    custom_prompt=t.custom_prompt,
                    order_index=t.order_index,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                )
                for t in sorted(summary_templates, key=lambda x: x.order_index)
            ],
            structure_templates=structure_tree,
        )
    
    @staticmethod
    async def get_template_dependencies(db, template_id):
        """
        从三类子模板的 sources 字段推导依赖关系，纯内存计算，不查 dependency_edges。

        返回结构：
        - core_info_templates: 每个字段被哪些摘要/章节引用
        - summary_templates: 每个摘要引用了什么 + 被哪些章节引用
        - structure_templates: 每个章节引用了什么
        """
        core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, template_id)
        summaries = await SummaryTemplateMapper.get_by_template_id(db, template_id)
        structures = await StructureTemplateMapper.get_by_template_id(db, template_id)

        # 构建 field_key → label 的快速查找表
        ci_label = {ci.field_key: ci.field_name for ci in core_infos}
        sum_label = {s.field_key: s.title for s in summaries}
        struct_label = {st.field_key: st.title for st in structures}

        def extract_refs(sources: list) -> list:
            """从 sources 数组提取引用列表"""
            refs = []
            if not sources:
                return refs
            for src in sources:
                source_obj = src.get("source") or {}
                source_type = source_obj.get("value") if isinstance(source_obj, dict) else None
                match_keys = src.get("match_keys") or []
                for mk in match_keys:
                    fk = mk.get("value") if isinstance(mk, dict) else None
                    lbl = mk.get("label") if isinstance(mk, dict) else fk
                    if not fk:
                        continue
                    # 用实际 label 覆盖（更准确）
                    if source_type == "keyinfo":
                        lbl = ci_label.get(fk, lbl)
                    elif source_type == "summary":
                        lbl = sum_label.get(fk, lbl)
                    elif source_type == "chapter":
                        lbl = struct_label.get(fk, lbl)
                    refs.append({"type": source_type or "unknown", "field_key": fk, "label": lbl or fk})
            return refs

        # 构建被引用索引：field_key → [引用者信息]
        ci_referenced_by: dict = {ci.field_key: [] for ci in core_infos}
        sum_referenced_by: dict = {s.field_key: [] for s in summaries}

        for s in summaries:
            for ref in extract_refs(s.sources or []):
                if ref["type"] == "keyinfo" and ref["field_key"] in ci_referenced_by:
                    ci_referenced_by[ref["field_key"]].append(
                        {"type": "summary", "field_key": s.field_key, "label": s.title}
                    )

        for st in structures:
            # 从 paragraphs 里聚合所有 sources
            all_sources = []
            for para_def in (st.paragraphs or []):
                all_sources.extend(para_def.get("sources") or [])
            for ref in extract_refs(all_sources):
                if ref["type"] == "keyinfo" and ref["field_key"] in ci_referenced_by:
                    ci_referenced_by[ref["field_key"]].append(
                        {"type": "structure", "field_key": st.field_key, "label": st.title}
                    )
                if ref["type"] == "summary" and ref["field_key"] in sum_referenced_by:
                    sum_referenced_by[ref["field_key"]].append(
                        {"type": "structure", "field_key": st.field_key, "label": st.title}
                    )

        return {
            "core_info_templates": [
                {
                    "field_key": ci.field_key,
                    "field_name": ci.field_name,
                    "referenced_by": ci_referenced_by.get(ci.field_key, []),
                }
                for ci in core_infos
                if ci.field_type != "group"  # group 节点本身不被引用
            ],
            "summary_templates": [
                {
                    "field_key": s.field_key,
                    "title": s.title,
                    "references": extract_refs(s.sources or []),
                    "referenced_by": sum_referenced_by.get(s.field_key, []),
                }
                for s in summaries
            ],
            "structure_templates": [
                {
                    "field_key": st.field_key,
                    "title": st.title,
                    "references": extract_refs(
                        [src for para_def in (st.paragraphs or []) for src in (para_def.get("sources") or [])]
                    ),
                }
                for st in structures
            ],
        }

    # ----------------------------------------------------------------
    # 模板导出 / 导入
    # ----------------------------------------------------------------

    @staticmethod
    async def export_template_json(db: AsyncSession, template_id: UUID) -> dict:
        """
        将模板主表 + 三类子表 + 文献元数据序列化为可移植的 dict。
        - 不导出主键（template_id / core_template_id 等）
        - 保留 field_key（sources 引用依赖它）
        - 保留 literature_key（跨系统导入时用于匹配文献）
        - CoreInfoTemplate / StructureTemplate 以嵌套 children 表示树形结构
        """
        from fastapi import HTTPException
        from datetime import datetime, timezone
        from db.mappers.literature_mapper import LiteratureMapper

        template = await TemplateMapper.get_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="模板不存在")

        core_infos = await CoreInfoTemplateMapper.get_by_template_id(db, template_id)
        summaries = await SummaryTemplateMapper.get_by_template_id(db, template_id)
        structures = await StructureTemplateMapper.get_by_template_id(db, template_id)
        literatures = await LiteratureMapper.list_by_template_id(db, template_id)

        # 构建 CoreInfoTemplate 嵌套树
        def _ci_node(ci) -> dict:
            return {
                "field_name": ci.field_name,
                "field_key": ci.field_key,
                "field_type": ci.field_type,
                "default_value": ci.default_value,
                "options": ci.options,
                "is_required": ci.is_required,
                "order_index": ci.order_index,
                "children": sorted(
                    [_ci_node(c) for c in core_infos if c.parent_id == ci.core_template_id],
                    key=lambda x: x["order_index"],
                ),
            }

        ci_tree = sorted(
            [_ci_node(ci) for ci in core_infos if ci.parent_id is None],
            key=lambda x: x["order_index"],
        )

        # 构建 StructureTemplate 嵌套树
        def _st_node(st) -> dict:
            return {
                "title": st.title,
                "field_key": st.field_key,
                "level": st.level,
                "order_index": st.order_index,
                "paragraphs": st.paragraphs or [],
                "children": sorted(
                    [_st_node(c) for c in structures if c.parent_id == st.structure_template_id],
                    key=lambda x: x["order_index"],
                ),
            }

        st_tree = sorted(
            [_st_node(st) for st in structures if st.parent_id is None],
            key=lambda x: x["order_index"],
        )

        return {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "template": {
                "group_id": str(template.group_id),
                "purpose": template.purpose,
                "display_name": template.display_name,
                "content": template.content,
                "template_type": template.template_type,
            },
            "core_info_templates": ci_tree,
            "summary_templates": [
                {
                    "title": s.title,
                    "field_key": s.field_key,
                    "generation_mode": s.generation_mode,
                    "content_template": s.content_template,
                    "sources": s.sources,
                    "default_prompt": s.default_prompt,
                    "custom_prompt": s.custom_prompt,
                    "order_index": s.order_index,
                }
                for s in sorted(summaries, key=lambda x: x.order_index)
            ],
            "structure_templates": st_tree,
            "literature_references": [
                {
                    "literature_key": lit.literature_key,
                    "title": lit.title,
                    "authors": lit.authors,
                    "journal": lit.journal,
                    "doi": lit.doi,
                    "impact_factor": lit.impact_factor,
                    "scope": lit.scope,
                }
                for lit in literatures
            ],
        }

    @staticmethod
    async def import_template_json(
        db: AsyncSession,
        data: dict,
        user_id: UUID,
        template_type: int = None,
    ) -> Template:
        """
        从导出的 JSON dict 创建新模板。
        - 重新生成所有主键
        - group_id 重新生成（不复用，避免与系统模板形成 group 关联）
        - template_type：不传则默认 USER_REUSABLE（type=2）；传 SYSTEM（type=1）时 user_id 应为 None
        - field_key 原样保留（sources 引用依赖它）
        """
        from fastapi import HTTPException

        if template_type is None:
            template_type = TemplateType.USER_REUSABLE

        # 基本校验
        tpl_data = data.get("template", {})
        if not tpl_data.get("purpose") or not tpl_data.get("display_name"):
            raise HTTPException(status_code=400, detail="JSON 格式错误：缺少 template.purpose 或 template.display_name")

        # 1. 创建主表
        new_template = Template(
            group_id=uuid4(),
            purpose=tpl_data["purpose"],
            display_name=tpl_data["display_name"],
            content=tpl_data.get("content") or {},
            version=1,
            template_type=template_type,
            user_id=user_id,
            document_id=None,
            is_active=True,
        )
        await TemplateMapper.create_template(db, new_template)

        # 2. 递归写入 CoreInfoTemplate（DFS，父先于子）
        async def _flush_and_recurse(nodes: list, parent_id=None):
            for node in sorted(nodes, key=lambda x: x.get("order_index", 0)):
                ci = CoreInfoTemplate(
                    template_id=new_template.template_id,
                    parent_id=parent_id,
                    field_name=node.get("field_name", ""),
                    field_key=node.get("field_key", "core_" + uuid4().hex[:8]),
                    field_type=node.get("field_type", "text"),
                    default_value=node.get("default_value"),
                    options=node.get("options"),
                    is_required=node.get("is_required", True),
                    order_index=node.get("order_index", 0),
                )
                db.add(ci)
                await db.flush()
                children = node.get("children") or []
                if children:
                    await _flush_and_recurse(children, parent_id=ci.core_template_id)

        await _flush_and_recurse(data.get("core_info_templates") or [])

        # 3. 平铺写入 SummaryTemplate
        for s in sorted(data.get("summary_templates") or [], key=lambda x: x.get("order_index", 0)):
            db.add(SummaryTemplate(
                template_id=new_template.template_id,
                title=s.get("title", ""),
                field_key=s.get("field_key", "summary_" + uuid4().hex[:8]),
                generation_mode=s.get("generation_mode", 0),
                content_template=s.get("content_template"),
                sources=s.get("sources"),
                default_prompt=s.get("default_prompt"),
                custom_prompt=s.get("custom_prompt"),
                order_index=s.get("order_index", 0),
            ))

        # 4. 递归写入 StructureTemplate（DFS，父先于子）
        async def _flush_and_recurse_st(nodes: list, parent_id=None):
            for node in sorted(nodes, key=lambda x: x.get("order_index", 0)):
                st = StructureTemplate(
                    template_id=new_template.template_id,
                    parent_id=parent_id,
                    title=node.get("title", ""),
                    field_key=node.get("field_key", "struct_" + uuid4().hex[:8]),
                    level=node.get("level", 1),
                    order_index=node.get("order_index", 0),
                    paragraphs=node.get("paragraphs") or [],
                )
                db.add(st)
                await db.flush()
                children = node.get("children") or []
                if children:
                    await _flush_and_recurse_st(children, parent_id=st.structure_template_id)

        await _flush_and_recurse_st(data.get("structure_templates") or [])

        # 5. 匹配并绑定文献
        # 匹配优先级：literature_key → DOI → 标题归一化
        from db.mappers.literature_mapper import LiteratureMapper
        from db.mappers.template_literature_mapper import TemplateLiteratureMapper

        unmatched_literature = []
        for lit_ref in data.get("literature_references") or []:
            lit = None
            lit_key = lit_ref.get("literature_key")
            doi = lit_ref.get("doi")
            title = lit_ref.get("title")

            if lit_key:
                lit = await LiteratureMapper.find_by_key(db, lit_key)
            if not lit and doi:
                lit = await LiteratureMapper.find_by_doi(db, doi)
            if not lit and title:
                lit = await LiteratureMapper.find_by_title(db, title)

            if lit:
                await TemplateLiteratureMapper.bind(db, new_template.template_id, lit.literature_id)
            else:
                unmatched_literature.append({
                    "literature_key": lit_key,
                    "title": title,
                    "doi": doi,
                })

        await db.commit()
        await db.refresh(new_template)
        return new_template, unmatched_literature
