from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.summary_mapper import SummaryMapper, ParagraphSummaryLinkMapper
from db.models import DocumentSummary, ParagraphSummaryLink
from schemas.schemas import DocumentSummaryCreate, DocumentSummaryUpdate
from uuid import UUID
import json
from services.ai_service import call_qwen_stream

class SummaryService:
    @staticmethod
    async def create_summary(db: AsyncSession, summary_in: DocumentSummaryCreate):
        # 使用请求中提供的order_index，如果没有则根据文档的摘要数量来计算
        order_index = summary_in.order_index
        if order_index is None:
            from sqlalchemy import func, select
            count_result = await db.execute(
                select(func.count(DocumentSummary.summary_id))
                .where(DocumentSummary.document_id == summary_in.document_id)
            )
            count = count_result.scalar() or 0
            order_index = count
        
        # 创建新摘要
        new_summary = DocumentSummary(
            document_id=summary_in.document_id,    # 关联文档
            title=summary_in.title,                # 摘要标题
            content=summary_in.content,            # 摘要内容
            version=1,                             # 初始版本号
            order_index=order_index                # 排序索引
        )
        
        return await SummaryMapper.create_summary(db, new_summary)

    @staticmethod
    async def get_summary_by_id(db: AsyncSession, summary_id: UUID):
        return await SummaryMapper.get_summary_by_id(db, summary_id)



    @staticmethod
    async def get_summaries_by_document_id(db: AsyncSession, document_id: UUID):
        return await SummaryMapper.get_summaries_by_document_id(db, document_id)

    @staticmethod
    async def update_summary(db: AsyncSession, summary_id: UUID, summary_in: DocumentSummaryUpdate):
        # 获取旧摘要
        old_summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not old_summary:
            return None
        
        # 检查是否有实质性变更
        # 处理 content 为空字符串的情况
        new_content = summary_in.content if summary_in.content is not None else old_summary.content
        is_substantial_change = await SummaryService._is_substantial_change(
            old_summary.content, 
            new_content
        )
        
        # 创建历史记录
        from db.models import DocumentSummaryHistory
        history = DocumentSummaryHistory(
            summary_id=summary_id,
            version=old_summary.version,
            title=old_summary.title,
            content=old_summary.content
        )
        db.add(history)
        
        # 直接更新现有摘要记录，增加版本号
        update_data = {
            "title": summary_in.title if summary_in.title is not None else old_summary.title,
            "content": new_content,
            "order_index": summary_in.order_index if summary_in.order_index is not None else old_summary.order_index,
            "version": old_summary.version + 1,
            "is_change": 1 if is_substantial_change else 0
        }
        updated_summary = await SummaryMapper.update_summary(db, summary_id, update_data)
        
        # 处理关联段落更新，传递变更状态
        await SummaryService._handle_summary_change(db, old_summary, updated_summary, is_substantial_change)
        return updated_summary

    @staticmethod
    async def delete_summary(db: AsyncSession, summary_id: UUID):
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if summary:
            await SummaryMapper.delete_summary(db, summary)
            return {"message": "删除成功"}
        return {"message": "摘要不存在"}

    @staticmethod
    async def _is_substantial_change(old_content, new_content):
        """
        检测摘要内容是否发生实质性变更
        """
        # 初步筛选：检查是否有明显的非实质性变更
        def normalize_content(content):
            if isinstance(content, str):
                # 移除多余空格和标点符号
                import re
                return re.sub(r'\s+', ' ', content).strip()
            return content
        
        # 比较规范化后的内容
        normalized_old = normalize_content(old_content)
        normalized_new = normalize_content(new_content)
        
        if normalized_old == normalized_new:
            return False
        
        # 使用AI判断是否为实质性语义变更
        from services.prompt_templates import render_prompt, system_prompts
        prompt = render_prompt(
            "analyze_summary_change",
            old_content=json.dumps(old_content, ensure_ascii=False),
            new_content=json.dumps(new_content, ensure_ascii=False)
        )
        
        response = ""
        async for chunk in call_qwen_stream(
            system_prompts["analyze_summary_change"],
            [],
            prompt
        ):
            response += chunk
        
        return response.strip().lower() == "true"

    @staticmethod
    async def _handle_summary_change(db: AsyncSession, old_summary: DocumentSummary, new_summary: DocumentSummary, is_substantial_change):
        """
        处理摘要变更时的段落更新
        """
        if not is_substantial_change:
            return
        
        # 获取与旧摘要关联的段落
        links = await ParagraphSummaryLinkMapper.get_links_by_summary_id(db, old_summary.summary_id)
        
        for link in links:
            # 直接更新关联关系和段落状态
            await ParagraphSummaryLinkMapper.update_link(db, link.link_id, {
                "summary_id": new_summary.summary_id,
                "summary_version": new_summary.version
            })
            
            # 更新段落的ischange字段为1，表示关联摘要发生了实质变更
            from db.mappers.paragraph_mapper import ParagraphMapper
            await ParagraphMapper.update_paragraph(db, link.paragraph_id, {"ischange": 1})

    @staticmethod
    def _extract_relevant_sections(new_content, old_sections):
        """
        从新摘要中提取与旧摘要关联的部分
        """
        if not old_sections or not old_sections.get("sections"):
            return new_content
        
        old_section_ids = {section.get("id") for section in old_sections.get("sections", [])}
        new_sections = [section for section in new_content.get("sections", []) 
                       if section.get("id") in old_section_ids]
        
        return {"sections": new_sections}

    @staticmethod
    async def create_paragraph_summary_link(db: AsyncSession, paragraph_id: UUID, summary_id: UUID):
        summary = await SummaryMapper.get_summary_by_id(db, summary_id)
        if not summary:
            return None
        
        link = ParagraphSummaryLink(
            paragraph_id=paragraph_id,
            summary_id=summary_id,
            summary_version=summary.version
        )
        
        return await ParagraphSummaryLinkMapper.create_link(db, link)

    @staticmethod
    async def get_paragraph_summary_links(db: AsyncSession, paragraph_id: UUID):
        return await ParagraphSummaryLinkMapper.get_links_by_paragraph_id(db, paragraph_id)

    @staticmethod
    async def get_paragraph_related_summaries(db: AsyncSession, paragraph_id: UUID):
        """
        获取段落关联的摘要信息
        """
        # 获取段落的所有关联链接
        links = await ParagraphSummaryLinkMapper.get_links_by_paragraph_id(db, paragraph_id)
        
        related_summaries = []
        for link in links:
            # 获取摘要详情
            summary = await SummaryMapper.get_summary_by_id(db, link.summary_id)
            if summary:
                # 直接使用纯文本内容
                related_summaries.append({
                    "summary_id": summary.summary_id,
                    "document_id": summary.document_id,
                    "title": summary.title,
                    "content": summary.content,
                    "version": summary.version,
                    "created_at": summary.created_at,
                    "updated_at": summary.updated_at
                })
        
        return related_summaries

    @staticmethod
    async def get_summary_related_paragraphs(db: AsyncSession, summary_id: UUID):
        """
        获取摘要关联的段落信息
        """
        # 获取摘要的所有关联链接
        links = await ParagraphSummaryLinkMapper.get_links_by_summary_id(db, summary_id)
        
        related_paragraphs = []
        for link in links:
            # 获取段落详情
            from db.mappers.paragraph_mapper import ParagraphMapper
            paragraph = await ParagraphMapper.get_paragraph_by_id(db, link.paragraph_id)
            if paragraph:
                # 直接使用纯文本内容
                related_paragraphs.append({
                    "paragraph_id": paragraph.paragraph_id,
                    "chapter_id": paragraph.chapter_id,
                    "content": paragraph.content,
                    "para_type": paragraph.para_type,
                    "order_index": paragraph.order_index,
                    "ai_eval": paragraph.ai_eval,
                    "ai_suggestion": paragraph.ai_suggestion,
                    "summary_version": link.summary_version
                })
        
        return related_paragraphs

    @staticmethod
    async def generate_all_summaries(db: AsyncSession, document_id: UUID, keywords=None):
        """
        一键生成所有摘要
        """
        # 获取文档信息，预加载关键词
        from db.mappers.document_mapper import DocumentMapper
        from sqlalchemy.orm import joinedload
        from db.models import Document
        from sqlalchemy import select
        
        result = await db.execute(
            select(Document)
            .options(joinedload(Document.keywords))
            .where(Document.document_id == document_id)
        )
        document = result.unique().scalar_one_or_none()
        if not document:
            return None
        
        # 处理关键词
        document_keywords = []
        used_keyword_ids = []
        
        if keywords:
            # 根据用户传入的关键词ID列表获取对应的关键词内容
            from db.mappers.keyword_mapper import KeywordMapper
            for keyword_id in keywords:
                keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
                if keyword:
                    document_keywords.append(keyword.keyword)
                    used_keyword_ids.append(keyword_id)
        else:
            # 不指定关键词时，使用所有关键词
            if document.keywords:
                for keyword in document.keywords:
                    document_keywords.append(keyword.keyword)
                    used_keyword_ids.append(str(keyword.keyword_id))
        
        # 首先尝试从数据库获取摘要标题模板
        summary_types = []
        from services.template_service import TemplateService
        
        if document.purpose:
            # 查询数据库中对应目的的模板
            templates = await TemplateService.list_templates(
                db, 
                purpose=document.purpose,
                is_system=True,
                is_active=True
            )
            if templates and len(templates) > 0:
                # 使用数据库中的模板标题
                template = templates[0]
                summary_types = template.content.get('summary', {}).get('title_templates', [])
        
        # 如果没有找到数据库模板，使用AI生成标题
        if not summary_types:
            from services.prompt_templates import render_prompt, system_prompts
            
            # 根据使用目的选择不同的模板
            if document.purpose:
                # 使用基于目的的标题模板
                topic_prompt = render_prompt(
                    "generate_summary_titles",
                    title=document.title,
                    abstract=document.abstract,
                    purpose=document.purpose,
                    keywords=', '.join(document_keywords) if document_keywords else None
                )
                system_prompt = system_prompts["generate_summary_titles"]
            else:
                # 使用通用的主题模板
                topic_prompt = render_prompt(
                    "generate_summary_topics",
                    title=document.title,
                    abstract=document.abstract,
                    purpose=document.purpose,
                    keywords=', '.join(document_keywords) if document_keywords else None
                )
                system_prompt = system_prompts["generate_summary_topics"]
            
            topic_response = ""
            async for chunk in call_qwen_stream(
                system_prompt,
                [],
                topic_prompt
            ):
                topic_response += chunk
            
            # 解析生成的主题列表
            seen_topics = set()
            summary_types = []
            for line in topic_response.strip().split('\n'):
                line = line.strip()
                if line and not line.startswith('===') and not line.startswith('---'):
                    # 移除可能的序号和标点
                    if any(line.startswith(str(i) + '.') for i in range(1, 10)):
                        line = line.split('.', 1)[1].strip()
                    elif any(line.startswith(str(i) + ')') for i in range(1, 10)):
                        line = line.split(')', 1)[1].strip()
                    # 去重
                    if line not in seen_topics:
                        seen_topics.add(line)
                        summary_types.append(line)
        else:
            # 对数据库模板中的标题进行去重
            seen_topics = set()
            unique_summary_types = []
            for line in summary_types:
                line = line.strip()
                if line and line not in seen_topics:
                    seen_topics.add(line)
                    unique_summary_types.append(line)
            summary_types = unique_summary_types
        
        # 确保摘要数量在3-5个之间
        if len(summary_types) < 3:
            # 添加默认主题
            default_topics = ["研究背景", "研究目的", "研究方法"]
            for topic in default_topics:
                if topic not in summary_types:
                    summary_types.append(topic)
                if len(summary_types) >= 3:
                    break
        elif len(summary_types) > 5:
            # 只取前5个主题
            summary_types = summary_types[:5]
        
        # 获取现有摘要
        existing_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        existing_summary_titles = {summary.title: summary for summary in existing_summaries}
        
        generated_summaries = []
        summary_ids = []
        
        # 生成摘要内容
        for i, summary_type in enumerate(summary_types):
            # 渲染提示词
            from services.prompt_templates import render_prompt, system_prompts
            prompt = render_prompt(
                "generate_summary",
                title=document.title,
                abstract=document.abstract,
                purpose=document.purpose,
                keywords=', '.join(document_keywords) if document_keywords else None,
                summary_type=summary_type
            )
            
            response = ""
            async for chunk in call_qwen_stream(
                system_prompts["generate_summary"],
                [],
                prompt
            ):
                response += chunk
            
            # 检查是否已存在相同标题的摘要
            if summary_type in existing_summary_titles:
                # 更新现有摘要
                existing_summary = existing_summary_titles[summary_type]
                update_data = {
                    "content": response.strip(),
                    "version": existing_summary.version + 1
                }
                updated_summary = await SummaryMapper.update_summary(db, existing_summary.summary_id, update_data)
                summary_ids.append(updated_summary.summary_id)
            else:
                # 创建新摘要
                summary_in = DocumentSummaryCreate(
                    document_id=document_id,
                    title=summary_type,
                    content=response.strip()
                )
                updated_summary = await SummaryService.create_summary(db, summary_in)
                summary_ids.append(updated_summary.summary_id)
        
        # 统一更新所有摘要的order_index
        from sqlalchemy import update
        for i, summary_id in enumerate(summary_ids):
            await db.execute(
                update(DocumentSummary)
                .where(DocumentSummary.summary_id == summary_id)
                .values(order_index=i)
            )
        
        # 提交事务
        await db.commit()
        
        # 重新获取所有摘要，确保order_index正确
        updated_summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
        
        # 按order_index排序
        updated_summaries.sort(key=lambda x: x.order_index)
        
        # 构建返回数据
        for summary in updated_summaries:
            # 建立摘要与关键词的关联
            if used_keyword_ids:
                from services.keyword_service import KeywordService
                for keyword_id_str in used_keyword_ids:
                    try:
                        from uuid import UUID
                        keyword_id = UUID(keyword_id_str)
                        await KeywordService.create_keyword_summary_link(db, keyword_id, summary.summary_id)
                    except Exception as e:
                        print(f"创建关键词摘要关联失败: {e}")
                        pass
            
            result = {
                "summary_id": summary.summary_id,
                "document_id": summary.document_id,
                "title": summary.title,
                "content": summary.content,
                "version": summary.version,
                "order_index": summary.order_index,
                "created_at": summary.created_at,
                "updated_at": summary.updated_at
            }
            generated_summaries.append(result)
        
        return generated_summaries
    
    @staticmethod
    async def assist_single_summary(db: AsyncSession, summary_id: str, keywords=None):
        """
        帮填单个摘要
        根据摘要状态自动判断帮填场景：
        - 场景1：无标题无内容 → AI帮填标题和内容
        - 场景2：有标题无内容 → AI只填内容
        - 场景3：无标题有内容 → AI帮填标题
        """
        from uuid import UUID
        summary_uuid = UUID(summary_id)
        
        # 获取摘要信息
        summary = await SummaryMapper.get_summary_by_id(db, summary_uuid)
        if not summary:
            return None
        
        # 获取文档信息，预加载关键词
        from db.mappers.document_mapper import DocumentMapper
        from sqlalchemy.orm import joinedload
        from db.models import Document
        from sqlalchemy import select
        
        result = await db.execute(
            select(Document)
            .options(joinedload(Document.keywords))
            .where(Document.document_id == summary.document_id)
        )
        document = result.unique().scalar_one_or_none()
        if not document:
            return None
        
        # 处理关键词
        document_keywords = []
        used_keyword_ids = []
        
        if keywords:
            # 根据用户传入的关键词ID列表获取对应的关键词内容
            from db.mappers.keyword_mapper import KeywordMapper
            for keyword_id in keywords:
                keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
                if keyword:
                    document_keywords.append(keyword.keyword)
                    used_keyword_ids.append(keyword_id)
        else:
            # 不指定关键词时，使用所有关键词
            if document.keywords:
                for keyword in document.keywords:
                    document_keywords.append(keyword.keyword)
                    used_keyword_ids.append(str(keyword.keyword_id))
        
        # 判断帮填场景
        has_title = bool(summary.title and summary.title.strip())
        has_content = bool(summary.content and summary.content.strip())
        
        if not has_title and not has_content:
            # 场景1：无标题无内容 → AI帮填标题和内容
            prompt = f"""
            请根据以下文档信息，生成一个完整的摘要（包括标题和内容）：
            
            文档标题：{document.title}
            文档摘要：{document.abstract or '无'}
            文档目的：{document.purpose or '无'}
            """
            
            if document_keywords:
                prompt += f"关键词：{', '.join(document_keywords)}\n"
            
            prompt += f"""
            
            要求：
            1. 首先生成一个合适的摘要标题
            2. 然后生成与标题相关的详细摘要内容
            3. 内容要专业、准确，符合临床研究规范
            4. 直接输出标题和内容，标题在前，内容在后，中间用空行分隔
            5. 不要使用任何其他格式标记
            """
            
            response = ""
            async for chunk in call_qwen_stream(
                "你是一个专业的临床研究方案摘要撰写助手",
                [],
                prompt
            ):
                response += chunk
            
            # 解析生成的标题和内容
            parts = response.strip().split('\n\n', 1)
            if len(parts) == 2:
                new_title, new_content = parts
            else:
                new_title = "摘要"
                new_content = response.strip()
                
        elif has_title and not has_content:
            # 场景2：有标题无内容 → AI只填内容
            prompt = f"""
            请根据以下文档信息，为{summary.title}生成详细的摘要内容：
            
            文档标题：{document.title}
            文档摘要：{document.abstract or '无'}
            文档目的：{document.purpose or '无'}
            """
            
            if document_keywords:
                prompt += f"关键词：{', '.join(document_keywords)}\n"
            
            prompt += f"""
            
            要求：
            1. 生成与{summary.title}相关的详细摘要内容
            2. 内容要专业、准确，符合临床研究规范
            3. 直接输出摘要内容，使用纯文本格式
            4. 不要使用任何标题符号或格式标记
            """
            
            response = ""
            async for chunk in call_qwen_stream(
                "你是一个专业的临床研究方案摘要撰写助手",
                [],
                prompt
            ):
                response += chunk
            
            new_title = summary.title
            new_content = response.strip()
            
        elif not has_title and has_content:
            # 场景3：无标题有内容 → AI帮填标题
            prompt = f"""
            请根据以下文档信息和摘要内容，为该摘要生成一个合适的标题：
            
            文档标题：{document.title}
            文档摘要：{document.abstract or '无'}
            文档目的：{document.purpose or '无'}
            摘要内容：{summary.content}
            """
            
            if document_keywords:
                prompt += f"关键词：{', '.join(document_keywords)}\n"
            
            prompt += f"""
            
            要求：
            1. 生成一个简洁、准确的摘要标题
            2. 标题要能够概括摘要内容的核心
            3. 直接输出标题，不要使用任何格式标记
            """
            
            response = ""
            async for chunk in call_qwen_stream(
                "你是一个专业的临床研究方案摘要撰写助手",
                [],
                prompt
            ):
                response += chunk
            
            new_title = response.strip()
            new_content = summary.content
            
        else:
            # 有标题有内容，不需要帮填
            return {
                "summary_id": summary.summary_id,
                "document_id": summary.document_id,
                "title": summary.title,
                "content": summary.content,
                "version": summary.version,
                "created_at": summary.created_at,
                "updated_at": summary.updated_at
            }
        
        # 更新摘要
        update_data = {
            "title": new_title,
            "content": new_content,
            "ai_generate": new_content,
            "version": summary.version + 1
        }
        updated_summary = await SummaryMapper.update_summary(db, summary_uuid, update_data)
        
        # 建立摘要与关键词的关联
        if used_keyword_ids:
            from services.keyword_service import KeywordService
            for keyword_id_str in used_keyword_ids:
                try:
                    keyword_id = UUID(keyword_id_str)
                    await KeywordService.create_keyword_summary_link(db, keyword_id, updated_summary.summary_id)
                except Exception as e:
                    print(f"创建关键词摘要关联失败: {e}")
                    pass
        
        # 构建返回数据
        result = {
            "summary_id": updated_summary.summary_id,
            "document_id": updated_summary.document_id,
            "title": updated_summary.title,
            "content": updated_summary.content,
            "version": updated_summary.version,
            "ai_generate": updated_summary.ai_generate,
            "created_at": updated_summary.created_at,
            "updated_at": updated_summary.updated_at
        }
        
        return result
