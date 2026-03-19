from schemas.schemas import DocumentKeywordUpdate
import dashscope
from http import HTTPStatus
import json
import uuid

from schemas.schemas import DocumentSummaryCreate,ParagraphCreate
from db.mappers.summary_mapper import SummaryMapper
from db.mappers.document_mapper import DocumentMapper
from sqlalchemy.orm import joinedload

from services.summary_service import SummaryService
from db.mappers.keyword_mapper import KeywordMapper
from db.mappers.chapter_mapper import ChapterMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from services.prompt_templates import render_prompt, system_prompts
from fastapi import HTTPException

from sqlalchemy import select, update
from db.models import Paragraph, Chapter, Document, DocumentKeyword
from services.keyword_service import KeywordService

from services.ai_client import call_qwen_stream

from difflib import SequenceMatcher
import re

from services.dependency_service import DependencyService

# 配置您的百炼 API Key
# dashscope.api_key = "您的阿里云百炼API_KEY"

# AI帮填关键词
async def ai_assist_keyword(db, document_id):
    # 获取文档信息
    document = await DocumentMapper.get_document_by_id(db, document_id)
    if not document:
        return []
    # 渲染提示词
    prompt = render_prompt(
        "extract_keywords",
        title=document.title,
        purpose=document.purpose
    )
    
    response = ""
    async for chunk in call_qwen_stream(
        system_prompts["extract_keywords"],
        [],
        prompt
    ):
        response += chunk
    
    print("------------------------------\n"+response+"\n------------------------------")

    # 解析关键词列表
    keywords = []
    for line in response.strip().split('\n'):
        line = line.strip()
        if line and not line.startswith('===') and not line.startswith('---'):
            # 移除可能的序号和标点
            if any(line.startswith(str(i) + '.') for i in range(1, 10)):
                line = line.split('.', 1)[1].strip()
            elif any(line.startswith(str(i) + ')') for i in range(1, 10)):
                line = line.split(')', 1)[1].strip()
            keywords.append(line)
    
    # 保存生成的关键词
    saved_keywords = []
    for keyword in keywords[:10]:  # 最多保存10个关键词
        keyword_in = DocumentKeywordUpdate(
            keyword=keyword
        )
        # 直接使用KeywordMapper.create_keyword方法
        new_keyword_obj = DocumentKeyword(
            document_id=document_id,
            keyword=keyword_in.keyword
        )
        new_keyword = await KeywordMapper.create_keyword(db, new_keyword_obj)
        saved_keywords.append({
            "keyword_id": new_keyword.keyword_id,
            "document_id": new_keyword.document_id,
            "keyword": new_keyword.keyword,
            "created_at": new_keyword.created_at,
            "updated_at": new_keyword.updated_at
        })
    
    return saved_keywords

# 定义AI帮填段落
async def ai_assist_paragraph(db, paragraph_id, assist_request):
    try:
        # 1. 查询段落信息及其所属章节和文档的元数据，预加载关键词
        result = await db.execute(
            select(Paragraph, Chapter, Document)
            .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
            .join(Document, Chapter.document_id == Document.document_id)
            .options(joinedload(Document.keywords))
            .where(Paragraph.paragraph_id == paragraph_id)
        )
        data = result.first()

        if not data:
            yield "data: {\"error\": \"段落或章节或文档不存在\"}\n\n"
            return

        target_paragraph, chapter, document = data
        
        # 检查段落类型，只有paragraph类型的段落才能使用AI帮填
        if target_paragraph.para_type != "paragraph":
            yield "data: {\"error\": \"只有正文类型的段落才能使用AI帮填功能\"}\n\n"
            return

        # 2. 提取当前段落的所有层级标题
        hierarchy_titles = []
        para_result = await db.execute(
            select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
        )
        paragraphs = para_result.scalars().all()
        
        for para in paragraphs:
            if para.para_type in ['heading-1', 'heading-2', 'heading-3']:
                hierarchy_titles.append({
                    "type": para.para_type,
                    "content": para.content
                })
            if para.paragraph_id == paragraph_id:
                break

        # 3. 获取摘要信息
        summary_sections = None
        used_summary_ids = []
        
        if assist_request.summary_sections:
            # 根据用户传入的摘要ID列表获取对应的摘要内容
            
            summaries = []
            for summary_id in assist_request.summary_sections:
                summary = await SummaryMapper.get_summary_by_id(db, summary_id)
                if summary:
                    summaries.append(f"{summary.title}：\n{summary.content}")
                    used_summary_ids.append(summary_id)
            if summaries:
                summary_sections = "\n\n".join(summaries)
        else:
            # 不指定摘要时，获取文档的所有摘要
            all_summaries = await SummaryService.get_summaries_by_document_id(db, document.document_id)
            if all_summaries:
                summaries = []
                for summary in all_summaries:
                    summaries.append(f"{summary.title}：\n{summary.content}")
                    used_summary_ids.append(str(summary.summary_id))
                if summaries:
                    summary_sections = "\n\n".join(summaries)

        # 4. 处理关键词
        document_keywords = []
        used_keyword_ids = []
        all_keywords = []
        
        if assist_request.keywords:
            # 根据用户传入的关键词ID列表获取对应的关键词内容
            for keyword_id in assist_request.keywords:
                keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
                if keyword:
                    document_keywords.append(keyword.keyword)
                    used_keyword_ids.append(keyword_id)
        else:
            # 不指定关键词时，收集所有关键词用于AI生成和后续匹配
            if document.keywords:
                for keyword in document.keywords:
                    document_keywords.append(keyword.keyword)
                    all_keywords.append((keyword.keyword, str(keyword.keyword_id)))

        # 获取流式输出内容
        chapter_title = chapter.title
        full_content = ""
        
        # 渲染提示词
        prompt = render_prompt(
            "assist",
            title=document.title,
            keywords=", ".join(document_keywords),
            chapter_title=chapter_title,
            hierarchy_titles=hierarchy_titles,
            summary_sections=summary_sections,
            current_content=target_paragraph.content
        )

        responses = dashscope.Generation.call(
            model='qwen-max',  # 或者使用 qwen-plus
            messages=[
                {'role': 'system', 'content': system_prompts["assist"]},
                {'role': 'user', 'content': prompt}
            ],
            result_format='message',
            stream=True,
            incremental_output=True
        )

        for response in responses:
            if response.status_code == HTTPStatus.OK:
                content = response.output.choices[0]['message']['content']
                # 封装为前端易读的 SSE 格式
                chunk = f"data: {json.dumps({'content': content})}\n\n"
                full_content += content
                yield chunk
            else:
                chunk = f"data: {json.dumps({'error': 'AI 生成失败'})}\n\n"
                yield chunk

        # 流结束后，将最终内容存入数据库
        from sqlalchemy import update
        await db.execute(
            update(Paragraph)
            .where(Paragraph.paragraph_id == paragraph_id)
            .values(
                ai_generate=full_content
            )
        )
        await db.commit()

        # 建立段落与摘要的关联
        if used_summary_ids:
            for summary_id_str in used_summary_ids:
                try:
                    from db.mappers.summary_mapper import SummaryMapper
                    summary_id = uuid.UUID(summary_id_str)
                    summary = await SummaryMapper.get_summary_by_id(db, summary_id)
                    if summary:
                        await DependencyService.create_dependency_edge(
                            db, "paragraph", paragraph_id, "summary", summary.summary_id, target_version=summary.version
                        )
                except Exception as e:
                    print(f"创建摘要关联失败: {e}")
                    pass

        # 建立段落与关键词的关联
        local_used_keyword_ids = used_keyword_ids.copy()
        
        # 如果用户未指定关键词，根据生成的内容进行字符串匹配
        if not assist_request.keywords and all_keywords:
            for keyword, keyword_id_str in all_keywords:
                if keyword in full_content:
                    local_used_keyword_ids.append(keyword_id_str)
        
        if local_used_keyword_ids:
            for keyword_id_str in local_used_keyword_ids:
                try:
                    keyword_id = uuid.UUID(keyword_id_str)
                    
                    from db.mappers.keyword_mapper import KeywordMapper
                    keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
                    if keyword:
                        await DependencyService.create_dependency_edge(
                            db, "paragraph", paragraph_id, "keyword", keyword_id, target_version=keyword.version
                        )
                except Exception as e:
                    print(f"创建关键词关联失败: {e}")
                    pass

        # 发送结束标识
        yield "data: [DONE]\n\n"
    except Exception as e:
        print(f"AI 帮填失败: {e}")
        yield f"data: {{\"error\": \"AI 帮填失败\"}}\n\n"


# 检查内容是否发生实质性变更
async def is_substantial_change(old_content: str, new_content: str) -> bool:
    """
    检测内容是否发生实质性变更
    适用于段落、摘要等文本内容的变更检测
    采用多层判断策略，尽可能减少AI调用
    """
    # --- 第一层：规范化比较 ---
    def advanced_normalize(content):
        """高级规范化：移除多余空格、标点符号，统一大小写"""
        if isinstance(content, str):
            text = re.sub(r'\s+', ' ', content) # 移除多余空格和换行
            text = re.sub(r'[^\w\s]', '', text) # 移除标点符号
            text = text.lower().strip() # 统一小写
            return text
        return content
    
    norm_old = advanced_normalize(old_content)
    norm_new = advanced_normalize(new_content)
    
    if norm_old == norm_new:
        return False    # 规范化后完全相同，说明只是格式变化
    
    len_old, len_new = len(norm_old), len(norm_new)
    if len_old > 0:
        change_rate = abs(len_new - len_old) / len_old
        if change_rate > 0.4:  # 长度变化超过40%，肯定是实质性变更
            return True
    
    similarity = SequenceMatcher(None, norm_old, norm_new).ratio()
    if similarity > 0.9:    # 如果相似度在 90% 以上，通常只是修饰词、标点或错别字
        return False
        
    # --- 最后一层：AI 兜底 ---
    prompt = render_prompt(
        "analyze_content_change",
        old_content=json.dumps(old_content, ensure_ascii=False),
        new_content=json.dumps(new_content, ensure_ascii=False)
    )
    
    response = ""
    async for chunk in call_qwen_stream(
        system_prompts["analyze_content_change"],
        [],
        prompt
    ):
        response += chunk

    print("--------------------------------\n"+response+"\n--------------------------------")
    
    return response.strip().lower() == "true"

# AI评估段落内容
def ai_evaluate_paragraph(paragraph_id):
    """
    AI 评估段落内容（流式）
    """
    async def evaluate_and_save(db):
        try:
            # 查询段落信息及其所属章节和文档的元数据
            result = await db.execute(
                select(Paragraph, Chapter, Document)
                .join(Chapter, Paragraph.chapter_id == Chapter.chapter_id)
                .join(Document, Chapter.document_id == Document.document_id)
                .where(Paragraph.paragraph_id == paragraph_id)
            )
            data = result.first()

            if not data:
                yield "data: {\"error\": \"段落或章节或文档不存在\"}\n\n"
                return

            target_paragraph, chapter, document = data

            paragraph_content = target_paragraph.content
            if not paragraph_content:
                yield "data: {\"error\": \"段落内容为空，无法评估\"}\n\n"
                return
            
            # 提取当前段落的所有层级标题
            hierarchy_titles = []
            paragraph_title = ""
            para_result = await db.execute(
                select(Paragraph).where(Paragraph.chapter_id == chapter.chapter_id).order_by(Paragraph.order_index)
            )
            paragraphs = para_result.scalars().all()
            
            for para in paragraphs:
                if para.para_type in ['heading-1', 'heading-2', 'heading-3']:
                    hierarchy_titles.append({
                        "type": para.para_type,
                        "content": para.content
                    })
                    # 最后一个标题作为段落标题
                    paragraph_title = para.content
                if para.paragraph_id == paragraph_id:
                    break
            
            # 直接使用章节的title字段
            chapter_title = chapter.title
            
            # 获取摘要信息
            summary_sections = None
            # 对于AI评估，使用段落相关联的摘要
            related_summaries = await SummaryService.get_paragraph_related_summaries(db, paragraph_id)
            if related_summaries:
                summaries = []
                for summary_info in related_summaries:
                    summaries.append(f"{summary_info['title']}：\n{summary_info['content']}")
                if summaries:
                    summary_sections = "\n\n".join(summaries)
            
            # 处理关键词
            document_keywords = []
            if document.keywords:
                for keyword in document.keywords:
                    document_keywords.append(keyword.keyword)
            
            # 渲染提示词
            prompt = render_prompt(
                "evaluate",
                title=document.title,
                keywords=", ".join(document_keywords),
                chapter_title=chapter_title,
                hierarchy_titles=hierarchy_titles,
                summary_sections=summary_sections,
                paragraph_title=paragraph_title,
                paragraph_content=paragraph_content
            )

            # 调用AI模型生成评估结果
            responses = dashscope.Generation.call(
                model='qwen-max',
                messages=[
                    {'role': 'system', 'content': system_prompts["evaluate"]},
                    {'role': 'user', 'content': prompt}
                ],
                result_format='message',
                stream=True,
                incremental_output=True
            )

            # 处理AI响应并生成流式数据
            full_content = ""
            evaluation = ""
            suggestions = []
            
            for response in responses:
                if response.status_code == HTTPStatus.OK:
                    content = response.output.choices[0]['message']['content']
                    full_content += content
                    # 封装为前端易读的 SSE 格式
                    yield f"data: {json.dumps({'content': content})}\n\n"
                else:
                    yield f"data: {json.dumps({'error': 'AI 评估失败'})}\n\n"
            
            # 解析评估结果和建议
            evaluation = full_content.split('改进建议')[0].strip()
            suggestions = []
            if '改进建议' in full_content:
                suggestions_part = full_content.split('改进建议')[1].strip()
                # 简单提取建议列表
                for line in suggestions_part.split('\n'):
                    line = line.strip()
                    if line and (line.startswith('1.') or line.startswith('2.') or line.startswith('3.')):
                        suggestions.append(line[2:].strip())
            if not suggestions:
                suggestions = ['建议增加更多具体的数据支持', '可以补充一些最新的研究进展', '建议优化部分专业术语的表述']
            
            # 发送解析后的评估结果
            yield f"data: {json.dumps({'evaluation': evaluation, 'suggestions': suggestions})}\n\n"
            yield "data: [DONE]\n\n"
            
            # 流结束后，将最终评估结果存入数据库
            if evaluation and suggestions:
                await db.execute(
                    update(Paragraph)
                    .where(Paragraph.paragraph_id == paragraph_id)
                    .values(
                        ai_eval=evaluation,
                        ai_suggestion="\n".join(suggestions)
                    )
                )
                await db.commit()
            
        except Exception as e:
            print(f"AI 评估失败: {e}")
            yield f"data: {{\"error\": \"AI 评估失败\"}}\n\n"

    return evaluate_and_save

# AI生成章节内容
async def generate_chapter_content_stream(db, chapter_id):
    """
    从摘要生成章节内容（流式响应）
    """  
    # 获取章节信息
    chapter_obj, _ = await ChapterMapper.get_chapter_with_paragraphs(db, chapter_id)
    document = await DocumentMapper.get_document_by_id(db, chapter_obj.document_id) if chapter_obj else None
    
    if not chapter_obj or not document:
        raise HTTPException(status_code=404, detail="章节或文档不存在")
    
    # 获取文档的所有摘要
    summaries = await SummaryMapper.get_summaries_by_document_id(db, chapter_obj.document_id)
    
    # 获取文档的所有关键词
    keywords = await KeywordMapper.get_keywords_by_document_id(db, chapter_obj.document_id)
    keyword_list = [keyword.keyword for keyword in keywords]
    
    # 构建摘要信息
    summary_info = ""
    for summary in summaries:
        summary_info += f"摘要标题：{summary.title}\n摘要内容：{summary.content}\n\n"
    
    # 获取文档模板
    from db.mappers.template_mapper import TemplateMapper
    templates = await TemplateMapper.list_templates(
        db, 
        purpose=document.purpose,
        is_system=True,
        is_active=True
    )
    
    # 初始化sections列表
    sections = []
    
    if templates:
        # 使用模板的schema部分作为章节结构
        template = templates[0]
        schema_json = template.content.get('schema', {}).get('schema_json', [])
        
        # 解析文档结构模板
        for item in schema_json:
            section = {
                'title': item['title'],
                'type': item.get('type', 'heading-1'),  # 优先使用模板中的类型，默认一级标题
                'content': item['title'],
                'subsections': []
            }
            sections.append(section)
    else:
        # 渲染提示词，要求生成章节结构
        prompt = render_prompt(
            "generate_chapter_structure",
            summary_info=f"文档标题：{document.title}\n文档摘要：无\n文档目的：{document.purpose}\n文档关键词：{', '.join(keyword_list) if keyword_list else '无'}\n\n摘要信息：\n{summary_info}"
        )
        
        # 调用AI生成章节结构
        response = ""
        async for chunk in call_qwen_stream(
            system_prompts["generate_chapter_structure"],
            [],
            prompt
        ):
            response += chunk
        
        # 解析章节结构
        current_section = None
        
        for line in response.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # 解析Markdown格式的标题
            if line.startswith('# '):
                # 一级标题
                current_section = {
                    'title': line[2:].strip(),
                    'type': 'heading-1',
                    'content': line[2:].strip(),
                    'subsections': []
                }
                sections.append(current_section)
            elif line.startswith('## '):
                # 二级标题
                if current_section:
                    subsection = {
                        'title': line[3:].strip(),
                        'type': 'heading-2',
                        'content': line[3:].strip()
                    }
                    current_section['subsections'].append(subsection)
            elif line.startswith('### '):
                # 三级标题
                if current_section and current_section['subsections']:
                    # 将三级标题作为二级标题的内容
                    pass
    
    # 获取章节现有的段落，确定起始order_index
    existing_paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
    paragraph_order = len(existing_paragraphs) + 1
    
    # 添加所有生成的章节内容作为段落
    for section in sections:
        # 创建一级标题段落
        section_paragraph_in = ParagraphCreate(
            content=section['title'],
            para_type=section['type'],
            order_index=paragraph_order
        )
        from db.models import Paragraph
        section_paragraph_obj = Paragraph(
            chapter_id=chapter_id,
            content=section_paragraph_in.content,
            para_type=section_paragraph_in.para_type,
            order_index=section_paragraph_in.order_index
        )
        section_paragraph = await ParagraphMapper.create_paragraph(db, section_paragraph_obj)
        paragraph_order += 1
        
        # 发送标题信息
        yield f"data: {{\"type\": \"heading\", \"content\": \"{section['title']}\", \"paragraph_id\": \"{section_paragraph.paragraph_id}\"}}\n\n"
        
        # 构建层级标题信息
        hierarchy_titles = []
        for i, s in enumerate(sections):
            if i <= sections.index(section):
                hierarchy_titles.append({
                    'type': s['type'],
                    'content': s['title']
                })
        
        # 为一级标题生成内容
        section_content_prompt = f"""
        请根据以下文档信息和摘要内容，为{section['title']}生成详细的内容：
        
        文档标题：{document.title}
        文档摘要：无
        文档目的：{document.purpose}
        文档关键词：{', '.join(keyword_list) if keyword_list else '无'}
        
        层级标题：
        {chr(10).join([f"{t['type'].replace('heading-', 'H')}: {t['content']}" for t in hierarchy_titles])}
        
        摘要信息：
        {summary_info}
        
        要求：
        1. 生成与{section['title']}相关的详细内容
        2. 内容要专业、准确，符合临床研究规范
        3. 直接输出内容，使用纯文本格式
        4. 不要使用任何标题符号或格式标记
        """
        
        # 调用AI生成内容
        section_content = ""
        async for chunk in call_qwen_stream(
            "你是一个专业的临床研究方案内容撰写助手",
            [],
            section_content_prompt
        ):
            section_content += chunk
            # 发送内容片段
            yield f"data: {{\"type\": \"content_chunk\", \"content\": \"{chunk.replace('\"', '\\\"')}\"}}\n\n"
        
        # 创建内容段落
        content_paragraph_in = ParagraphCreate(
            content=section_content.strip(),
            para_type='paragraph',
            order_index=paragraph_order
        )
        content_paragraph_obj = Paragraph(
            chapter_id=chapter_id,
            content=content_paragraph_in.content,
            para_type=content_paragraph_in.para_type,
            order_index=content_paragraph_in.order_index
        )
        content_paragraph = await ParagraphMapper.create_paragraph(db, content_paragraph_obj)
        paragraph_order += 1
        
        # 发送完整内容信息
        yield f"data: {{\"type\": \"content\", \"content\": \"{section_content.strip().replace('\"', '\\\"')}\", \"paragraph_id\": \"{content_paragraph.paragraph_id}\"}}\n\n"
        
        # 建立段落与所有摘要的关联
        for summary in summaries:
            
            await DependencyService.create_dependency_edge(
                db, "paragraph", content_paragraph.paragraph_id, "summary", summary.summary_id, target_version=summary.version
            )
        
        # 处理子章节
        for subsection in section.get('subsections', []):
            # 创建二级标题段落
            subsection_paragraph_in = ParagraphCreate(
                content=subsection['title'],
                para_type=subsection['type'],
                order_index=paragraph_order
            )
            subsection_paragraph_obj = Paragraph(
                chapter_id=chapter_id,
                content=subsection_paragraph_in.content,
                para_type=subsection_paragraph_in.para_type,
                order_index=subsection_paragraph_in.order_index
            )
            subsection_paragraph = await ParagraphMapper.create_paragraph(db, subsection_paragraph_obj)
            paragraph_order += 1
            
            # 发送标题信息
            yield f"data: {{\"type\": \"heading\", \"content\": \"{subsection['title']}\", \"paragraph_id\": \"{subsection_paragraph.paragraph_id}\"}}\n\n"
            
            # 为子章节生成内容
            subsection_content_prompt = f"""
            请根据以下文档信息和摘要内容，为{subsection['title']}生成详细的内容：
            
            文档标题：{document.title}
            文档摘要：无
            文档目的：{document.purpose}
            文档关键词：{', '.join(keyword_list) if keyword_list else '无'}
            
            摘要信息：
            {summary_info}
            
            要求：
            1. 生成与{subsection['title']}相关的详细内容
            2. 内容要专业、准确，符合临床研究规范
            3. 直接输出内容，使用纯文本格式
            4. 不要使用任何标题符号或格式标记
            """
            
            subsection_content = ""
            async for chunk in call_qwen_stream(
                "你是一个专业的临床研究方案内容撰写助手",
                [],
                subsection_content_prompt
            ):
                subsection_content += chunk
                # 发送内容片段
                yield f"data: {{\"type\": \"content_chunk\", \"content\": \"{chunk.replace('\"', '\\\"')}\"}}\n\n"
            
            # 创建内容段落
            subsection_content_paragraph_in = ParagraphCreate(
                content=subsection_content.strip(),
                para_type='paragraph',
                order_index=paragraph_order
            )
            subsection_content_paragraph_obj = Paragraph(
                chapter_id=chapter_id,
                content=subsection_content_paragraph_in.content,
                para_type=subsection_content_paragraph_in.para_type,
                order_index=subsection_content_paragraph_in.order_index
            )
            subsection_content_paragraph = await ParagraphMapper.create_paragraph(db, subsection_content_paragraph_obj)
            paragraph_order += 1
            
            # 发送完整内容信息
            yield f"data: {{\"type\": \"content\", \"content\": \"{subsection_content.strip().replace('\"', '\\\"')}\", \"paragraph_id\": \"{subsection_content_paragraph.paragraph_id}\"}}\n\n"
            
            # 建立段落与所有摘要的关联
            for summary in summaries:
                
                await DependencyService.create_dependency_edge(
                    db, "paragraph", subsection_content_paragraph.paragraph_id, "summary", summary.summary_id, target_version=summary.version
                )
    
    # 发送结束标识
    yield "data: {\"type\": \"end\"}\n\n"

# AI一键生成所有摘要
async def generate_all_summaries(db, document_id):
    """
    一键生成所有摘要
    """
    # 获取文档信息，预加载关键词
    result = await db.execute(
        select(Document)
        .options(joinedload(Document.keywords))
        .where(Document.document_id == document_id)
    )
    document = result.unique().scalar_one_or_none()
    if not document:
        return None
    
    # 处理关键词 - 直接使用文档的所有关键词
    document_keywords = []
    used_keyword_ids = []
    
    if document.keywords:
        for keyword in document.keywords:
            document_keywords.append(keyword.keyword)
            used_keyword_ids.append(str(keyword.keyword_id))
    
    # 首先尝试从数据库获取摘要标题模板
    summary_types = []
    
    if document.purpose:
        # 查询数据库中对应目的的模板
        from db.mappers.template_mapper import TemplateMapper
        templates = await TemplateMapper.list_templates(
            db, 
            purpose=document.purpose,
            is_system=True,
            is_active=True
        )
        if templates and len(templates) > 0:
            # 使用数据库中的模板标题
            template = templates[0]
            # 确保模板内容格式正确
            if isinstance(template.content, dict) and 'summary' in template.content:
                summary_section = template.content['summary']
                if isinstance(summary_section, dict) and 'title_templates' in summary_section:
                    summary_types = summary_section['title_templates']
                    # 确保summary_types是列表
                    if not isinstance(summary_types, list):
                        summary_types = []
    
    # 如果没有找到数据库模板，使用AI生成标题
    if not summary_types:
        # 根据使用目的选择不同的模板
        if document.purpose:
            # 使用基于目的的标题模板
            topic_prompt = render_prompt(
                "generate_summary_titles",
                title=document.title,
                abstract=None,
                purpose=document.purpose,
                keywords=', '.join(document_keywords) if document_keywords else None
            )
            system_prompt = system_prompts["generate_summary_titles"]
        else:
            # 使用通用的主题模板
            topic_prompt = render_prompt(
                "generate_summary_topics",
                title=document.title,
                abstract=None,
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
    existing_summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
    existing_summary_titles = {summary.title: summary for summary in existing_summaries}
    
    generated_summaries = []
    summary_ids = []
    
    # 生成摘要内容
    for i, summary_type in enumerate(summary_types):
        # 渲染提示词
        prompt = render_prompt(
            "generate_summary",
            title=document.title,
            abstract=None,
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
            from db.mappers.summary_mapper import SummaryMapper
            updated_summary = await SummaryMapper.update_summary(db, existing_summary.summary_id, update_data)
            summary_ids.append(updated_summary.summary_id)
        else:
            # 创建新摘要
            summary_in = DocumentSummaryCreate(
                document_id=document_id,
                title=summary_type,
                content=response.strip()
            )
            
            # 计算order_index
            order_index = summary_in.order_index
            if order_index is None:
                from sqlalchemy import func, select
                count_result = await db.execute(
                    select(func.count(DocumentSummary.summary_id))
                    .where(DocumentSummary.document_id == summary_in.document_id)
                )
                count = count_result.scalar() or 0
                order_index = count
            
            # 创建新摘要对象
            from db.models import DocumentSummary
            new_summary = DocumentSummary(
                document_id=summary_in.document_id,
                title=summary_in.title,
                content=summary_in.content,
                version=1,
                order_index=order_index
            )
            
            # 保存到数据库
            from db.mappers.summary_mapper import SummaryMapper
            updated_summary = await SummaryMapper.create_summary(db, new_summary)
            summary_ids.append(updated_summary.summary_id)
    
    # 统一更新所有摘要的order_index
    from sqlalchemy import update
    from db.models import DocumentSummary
    for i, summary_id in enumerate(summary_ids):
        await db.execute(
            update(DocumentSummary)
            .where(DocumentSummary.summary_id == summary_id)
            .values(order_index=i)
        )
    
    # 提交事务
    await db.commit()
    
    # 重新获取所有摘要，确保order_index正确
    updated_summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
    
    # 按order_index排序
    updated_summaries.sort(key=lambda x: x.order_index)
    
    # 构建返回数据
    for summary in updated_summaries:
        # 建立摘要与关键词的关联 - 根据摘要内容与关键词进行字符串匹配
        if used_keyword_ids:
            from services.keyword_service import KeywordService
            from uuid import UUID
            from db.mappers.keyword_mapper import KeywordMapper
            
            # 获取摘要内容
            summary_content = summary.content.lower() if summary.content else ""
            
            for keyword_id_str in used_keyword_ids:
                try:
                    keyword_id = UUID(keyword_id_str)
                    # 获取关键词信息
                    keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
                    if keyword:
                        # 检查关键词是否出现在摘要内容中
                        if keyword.keyword.lower() in summary_content:
                            
                            await DependencyService.create_dependency_edge(
                                db, "summary", summary.summary_id, "keyword", keyword_id
                            )
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

# AI帮填单个摘要
async def assist_single_summary(db, summary_id):
    """
    帮填单个摘要
    根据摘要状态自动判断帮填场景：
    - 场景1：无标题无内容 → AI帮填标题和内容
    - 场景2：有标题无内容 → AI只填内容
    - 场景3：无标题有内容 → AI帮填标题
    """
    # 检查 summary_id 是否已经是 UUID 对象
    if isinstance(summary_id, uuid.UUID):
        summary_uuid = summary_id
    else:
        summary_uuid = uuid.UUID(summary_id)

    
    # 获取摘要信息
    summary = await SummaryMapper.get_summary_by_id(db, summary_uuid)
    if not summary:
        return None
    
    # 获取文档信息，预加载关键词
    result = await db.execute(
        select(Document)
        .options(joinedload(Document.keywords))
        .where(Document.document_id == summary.document_id)
    )
    document = result.unique().scalar_one_or_none()
    if not document:
        return None
    
    # 收集文档关键词
    document_keywords = []
    if document.keywords:
        for keyword in document.keywords:
            document_keywords.append(keyword.keyword)
    
    # 构建摘要JSON数据
    summary_data = {
        "summary_id": str(summary.summary_id),
        "title": summary.title or "",
        "content": summary.content or "",
        "document_info": {
            "title": document.title,
            "purpose": document.purpose or "",
            "keywords": document_keywords
        }
    }
    
    # 构建统一的提示词
    prompt = render_prompt(
        "assist_summary",
        summary_data=json.dumps(summary_data, ensure_ascii=False, indent=2)
    )
    
    # 调用AI生成内容
    response = ""
    from services.prompt_templates import system_prompts
    async for chunk in call_qwen_stream(
        system_prompts["generate_summary"],
        [],
        prompt
    ):
        response += chunk
    
    # 解析AI响应
    new_title = summary.title
    new_content = None
    
    # 提取标题和内容
    lines = response.strip().split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('标题：'):
            # 只有当原标题为空时，才使用AI生成的标题
            if not summary.title:
                new_title = line[3:].strip()
        elif line.startswith('内容：'):
            new_content = line[3:].strip()
    
    # 确保标题不为空
    if not new_title:
        new_title = "摘要"
    
    # 更新摘要 - 只更新标题（如果原标题为空）和 ai_generate 字段
    update_data = {
        "version": summary.version + 1
    }
    
    # 只有当原标题为空时，才更新标题
    if not summary.title:
        update_data["title"] = new_title
    
    # 如果生成了内容，更新 ai_generate 字段
    if new_content:
        update_data["ai_generate"] = new_content
    updated_summary = await SummaryMapper.update_summary(db, summary_uuid, update_data)
    
    # 建立摘要与关键词的关联 - 根据摘要内容与关键词进行字符串匹配
    if document.keywords:
        from services.keyword_service import KeywordService
        from db.mappers.keyword_mapper import KeywordMapper
        
        # 获取摘要内容（使用ai_generate，因为这是最新生成的内容）
        summary_content = updated_summary.ai_generate.lower() if updated_summary.ai_generate else ""
        
        for keyword in document.keywords:
            try:
                # 检查关键词是否出现在摘要内容中
                if keyword.keyword.lower() in summary_content:
                    
                    await DependencyService.create_dependency_edge(
                        db, "summary", updated_summary.summary_id, "keyword", keyword.keyword_id
                    )
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
        "order_index": updated_summary.order_index,
        "ai_generate": updated_summary.ai_generate,
        "created_at": updated_summary.created_at,
        "updated_at": updated_summary.updated_at
    }
    
    return result