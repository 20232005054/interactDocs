from sqlalchemy.ext.asyncio import AsyncSession
from db.mappers.chapter_mapper import ChapterMapper
from db.mappers.paragraph_mapper import ParagraphMapper
from db.mappers.document_mapper import DocumentMapper
from db.models import Chapter
from schemas.schemas import ChapterCreate, ChapterUpdate
from uuid import UUID
from fastapi import HTTPException

class ChapterService:
    @staticmethod
    async def get_chapters_by_document_id(db: AsyncSession, document_id: UUID):
        chapters_with_paragraphs = await ChapterMapper.get_chapters_with_paragraphs(db, document_id)
        # 构建包含段落的字典列表
        chapter_list = []
        for chapter, paragraphs in chapters_with_paragraphs:
            chapter_dict = {
                "chapter_id": chapter.chapter_id,
                "document_id": chapter.document_id,
                "parent_id": chapter.parent_id,
                "title": chapter.title,
                "status": chapter.status,
                "order_index": chapter.order_index,
                "updated_at": chapter.updated_at,
                "paragraphs": paragraphs
            }
            chapter_list.append(chapter_dict)
        return chapter_list

    @staticmethod
    async def get_chapter_detail(db: AsyncSession, chapter_id: UUID):
        chapter, paragraphs = await ChapterMapper.get_chapter_with_paragraphs(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        # 构建包含段落的字典，而不是设置关系属性
        chapter_dict = {
            "chapter_id": chapter.chapter_id,
            "document_id": chapter.document_id,
            "parent_id": chapter.parent_id,
            "title": chapter.title,
            "status": chapter.status,
            "order_index": chapter.order_index,
            "updated_at": chapter.updated_at,
            "paragraphs": paragraphs
        }
        return chapter_dict

    @staticmethod
    async def create_chapter(db: AsyncSession, chapter_in: ChapterCreate):
        # 检查文档是否存在
        document = await DocumentMapper.get_document_by_id(db, chapter_in.document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 检查父章节是否存在
        if chapter_in.parent_id:
            parent_chapter = await ChapterMapper.get_chapter_by_id(db, chapter_in.parent_id)
            if not parent_chapter:
                raise HTTPException(status_code=404, detail="父章节不存在")
        
        # 创建新章节
        new_chapter = Chapter(
            document_id=chapter_in.document_id,
            parent_id=chapter_in.parent_id,
            title=chapter_in.title,
            status=chapter_in.status or "editing",
            order_index=chapter_in.order_index
        )
        
        return await ChapterMapper.create_chapter(db, new_chapter)

    @staticmethod
    async def update_chapter(db: AsyncSession, chapter_id: UUID, chapter_in: ChapterUpdate):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 构建更新数据
        update_data = {}
        if chapter_in.title is not None:
            update_data["title"] = chapter_in.title
        if chapter_in.status is not None:
            update_data["status"] = chapter_in.status
        if chapter_in.order_index is not None:
            update_data["order_index"] = chapter_in.order_index
        
        await ChapterMapper.update_chapter(db, chapter_id, update_data)
        # 获取更新后的章节和段落
        updated_chapter, paragraphs = await ChapterMapper.get_chapter_with_paragraphs(db, chapter_id)
        # 构建包含段落的字典
        chapter_dict = {
            "chapter_id": updated_chapter.chapter_id,
            "document_id": updated_chapter.document_id,
            "parent_id": updated_chapter.parent_id,
            "title": updated_chapter.title,
            "status": updated_chapter.status,
            "order_index": updated_chapter.order_index,
            "updated_at": updated_chapter.updated_at,
            "paragraphs": paragraphs
        }
        return chapter_dict

    @staticmethod
    async def delete_chapter(db: AsyncSession, chapter_id: UUID):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        await ChapterMapper.delete_chapter(db, chapter)
        return {"message": "删除成功"}

    @staticmethod
    async def get_chapter_toc(db: AsyncSession, chapter_id: UUID):
        chapter = await ChapterMapper.get_chapter_by_id(db, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="章节不存在")
        
        # 获取章节的段落
        paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(db, chapter_id)
        
        # 提取目录结构
        toc = []
        for para in paragraphs:
            if para.para_type in ['heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']:
                toc.append({
                    "id": str(para.paragraph_id),
                    "type": para.para_type,
                    "content": para.content,
                    "order_index": para.order_index
                })
        
        return toc

    @staticmethod
    async def generate_chapters_from_summary(db: AsyncSession, document_id: UUID):
        """
        从摘要一键生成正文章节
        """
        # 获取文档信息
        from db.mappers.document_mapper import DocumentMapper
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 获取文档的所有摘要
        from services.summary_service import SummaryService
        summaries = await SummaryService.get_summaries_by_document_id(db, document_id)
        if not summaries:
            raise HTTPException(status_code=404, detail="文档没有摘要")
        
        # 获取文档的所有关键词
        from db.mappers.keyword_mapper import KeywordMapper
        keywords = await KeywordMapper.get_keywords_by_document_id(db, document_id)
        keyword_list = [keyword.keyword for keyword in keywords]
        
        # 构建摘要信息
        summary_info = ""
        for summary in summaries:
            summary_info += f"摘要标题：{summary.title}\n摘要内容：{summary.content}\n\n"
        
        # 渲染提示词，要求生成章节结构
        from services.prompt_templates import render_prompt, system_prompts
        prompt = render_prompt(
            "generate_chapter_structure",
            summary_info=f"文档标题：{document.title}\n文档摘要：{document.abstract}\n文档目的：{document.purpose}\n文档关键词：{', '.join(keyword_list) if keyword_list else '无'}\n\n摘要信息：\n{summary_info}"
        )
        
        # 调用AI生成章节结构
        from services.ai_service import call_qwen_stream
        response = ""
        async for chunk in call_qwen_stream(
            system_prompts["generate_chapter_structure"],
            [],
            prompt
        ):
            response += chunk
        
        # 解析章节结构
        sections = []
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
        
        # 创建一个名为"正文"的章节
        from schemas.schemas import ChapterCreate
        chapter_in = ChapterCreate(
            document_id=document_id,
            title="正文",
            order_index=1
        )
        chapter = await ChapterService.create_chapter(db, chapter_in)
        
        # 创建段落
        from schemas.schemas import ParagraphCreate
        from services.paragraph_service import ParagraphService
        paragraph_order = 1
        
        # 添加所有生成的章节内容作为段落
        for section in sections:
            # 创建一级标题段落
            section_paragraph_in = ParagraphCreate(
                content=section['title'],
                para_type=section['type'],
                order_index=paragraph_order
            )
            await ParagraphService.create_paragraph(db, chapter.chapter_id, section_paragraph_in)
            paragraph_order += 1
            
            # 为一级标题生成内容（测试用，只生成简短内容）
            # 实际使用时可以取消注释下面的代码，使用AI生成完整内容
            # section_content = "这是测试内容，实际使用时由AI生成"
            
            # 为一级标题生成内容
            section_content_prompt = f"""
            请根据以下文档信息和摘要内容，为{section['title']}生成详细的内容：
            
            文档标题：{document.title}
            文档摘要：{document.abstract}
            文档目的：{document.purpose}
            文档关键词：{', '.join(keyword_list) if keyword_list else '无'}
            
            摘要信息：
            {summary_info}
            
            要求：
            1. 生成与{section['title']}相关的详细内容
            2. 内容要专业、准确，符合临床研究规范
            3. 直接输出内容，使用纯文本格式
            4. 不要使用任何标题符号或格式标记
            """
            
            section_content = ""
            async for chunk in call_qwen_stream(
                "你是一个专业的临床研究方案内容撰写助手",
                [],
                section_content_prompt
            ):
                section_content += chunk
            
            # 创建内容段落
            content_paragraph_in = ParagraphCreate(
                content=section_content.strip(),
                para_type='paragraph',
                order_index=paragraph_order
            )
            content_paragraph = await ParagraphService.create_paragraph(db, chapter.chapter_id, content_paragraph_in)
            paragraph_order += 1
            
            # 建立段落与所有摘要的关联
            for summary in summaries:
                await SummaryService.create_paragraph_summary_link(
                    db, content_paragraph.paragraph_id, summary.summary_id
                )
            
            # 处理子章节
            for subsection in section.get('subsections', []):
                # 创建二级标题段落
                subsection_paragraph_in = ParagraphCreate(
                    content=subsection['title'],
                    para_type=subsection['type'],
                    order_index=paragraph_order
                )
                await ParagraphService.create_paragraph(db, chapter.chapter_id, subsection_paragraph_in)
                paragraph_order += 1
                
                # 为子章节生成内容（测试用，只生成简短内容）
                # 实际使用时可以取消注释下面的代码，使用AI生成完整内容
                # subsection_content = "这是测试内容，实际使用时由AI生成"
                
                # 为子章节生成内容
                subsection_content_prompt = f"""
                请根据以下文档信息和摘要内容，为{subsection['title']}生成详细的内容：
                
                文档标题：{document.title}
                文档摘要：{document.abstract}
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
                
                # 创建内容段落
                subsection_content_paragraph_in = ParagraphCreate(
                    content=subsection_content.strip(),
                    para_type='paragraph',
                    order_index=paragraph_order
                )
                subsection_content_paragraph = await ParagraphService.create_paragraph(db, chapter.chapter_id, subsection_content_paragraph_in)
                paragraph_order += 1
                
                # 建立段落与所有摘要的关联
                for summary in summaries:
                    await SummaryService.create_paragraph_summary_link(
                        db, subsection_content_paragraph.paragraph_id, summary.summary_id
                    )
        
        # 返回创建的章节
        return {"chapters": [{
            "chapter_id": chapter.chapter_id,
            "title": chapter.title,
            "order_index": chapter.order_index
        }]}
