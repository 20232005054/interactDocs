from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from db.mappers.keyword_mapper import KeywordMapper
from db.models import DocumentKeyword, KeywordSummaryLink, KeywordParagraphLink
from schemas.schemas import DocumentKeywordCreate, DocumentKeywordUpdate
from uuid import UUID
import json
from services.ai_service import call_qwen_stream

class KeywordService:
    @staticmethod
    async def create_keyword(db: AsyncSession, keyword_in: DocumentKeywordCreate):
        new_keyword = DocumentKeyword(
            document_id=keyword_in.document_id,
            keyword=keyword_in.keyword
        )
        return await KeywordMapper.create_keyword(db, new_keyword)

    @staticmethod
    async def get_keyword_by_id(db: AsyncSession, keyword_id: UUID):
        return await KeywordMapper.get_keyword_by_id(db, keyword_id)

    @staticmethod
    async def get_keywords_by_document_id(db: AsyncSession, document_id: UUID):
        return await KeywordMapper.get_keywords_by_document_id(db, document_id)

    @staticmethod
    async def update_keyword(db: AsyncSession, keyword_id: UUID, keyword_in: DocumentKeywordUpdate):
        # 获取旧关键词
        old_keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if not old_keyword:
            return None
        
        # 检查是否有实质性变更
        is_substantial_change = await KeywordService._is_substantial_change(
            old_keyword.keyword, 
            keyword_in.keyword
        )
        
        if is_substantial_change:
            # 创建历史记录
            from db.models import DocumentKeywordHistory
            history = DocumentKeywordHistory(
                keyword_id=keyword_id,
                version=old_keyword.version,
                keyword=old_keyword.keyword
            )
            await db.add(history)
            
            # 更新关键词
            update_data = {
                "keyword": keyword_in.keyword,
                "version": old_keyword.version + 1
            }
            updated_keyword = await KeywordMapper.update_keyword(db, keyword_id, update_data)
            
            # 处理关联的摘要和段落更新
            await KeywordService._handle_keyword_change(db, old_keyword, updated_keyword)
            return updated_keyword
        else:
            # 不需要更新
            return old_keyword

    @staticmethod
    async def delete_keyword(db: AsyncSession, keyword_id: UUID):
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if keyword:
            await KeywordMapper.delete_keyword(db, keyword)
            return {"message": "删除成功"}
        return {"message": "关键词不存在"}

    @staticmethod
    async def _is_substantial_change(old_keyword, new_keyword):
        """
        检测关键词是否发生实质性变更
        """
        # 简单比较关键词内容
        return old_keyword != new_keyword

    @staticmethod
    async def _handle_keyword_change(db: AsyncSession, old_keyword: DocumentKeyword, new_keyword: DocumentKeyword):
        """
        处理关键词变更时的关联更新
        """
        # 获取与旧关键词关联的摘要和段落
        summary_links, paragraph_links = await KeywordMapper.get_links_by_keyword_id(db, old_keyword.keyword_id)
        
        # 处理关联的摘要
        for link in summary_links:
            # 更新摘要的相关内容或标记
            from db.mappers.summary_mapper import SummaryMapper
            summary = await SummaryMapper.get_summary_by_id(db, link.summary_id)
            if summary:
                # 这里可以添加更复杂的逻辑，例如重新生成摘要内容
                # 目前只标记摘要需要更新
                await SummaryMapper.update_summary(db, link.summary_id, {"updated_at": func.now()})
        
        # 处理关联的段落
        for link in paragraph_links:
            # 更新段落的ischange字段为1，表示关联关键词发生了实质变更
            from db.mappers.paragraph_mapper import ParagraphMapper
            await ParagraphMapper.update_paragraph(db, link.paragraph_id, {"ischange": 1})

    @staticmethod
    async def create_keyword_summary_link(db: AsyncSession, keyword_id: UUID, summary_id: UUID):
        link = KeywordSummaryLink(
            keyword_id=keyword_id,
            summary_id=summary_id
        )
        return await KeywordMapper.create_keyword_summary_link(db, link)

    @staticmethod
    async def create_keyword_paragraph_link(db: AsyncSession, keyword_id: UUID, paragraph_id: UUID):
        # 获取关键词信息，包括版本
        keyword = await KeywordMapper.get_keyword_by_id(db, keyword_id)
        if not keyword:
            return None
        
        link = KeywordParagraphLink(
            keyword_id=keyword_id,
            paragraph_id=paragraph_id,
            keyword_version=keyword.version
        )
        return await KeywordMapper.create_keyword_paragraph_link(db, link)

    @staticmethod
    async def get_summary_related_keywords(db: AsyncSession, summary_id: UUID):
        """
        获取摘要关联的关键词信息
        """
        links = await KeywordMapper.get_links_by_summary_id(db, summary_id)
        
        related_keywords = []
        for link in links:
            keyword = await KeywordMapper.get_keyword_by_id(db, link.keyword_id)
            if keyword:
                related_keywords.append({
                    "keyword_id": keyword.keyword_id,
                    "document_id": keyword.document_id,
                    "keyword": keyword.keyword,
                    "created_at": keyword.created_at,
                    "updated_at": keyword.updated_at
                })
        
        return related_keywords

    @staticmethod
    async def get_paragraph_related_keywords(db: AsyncSession, paragraph_id: UUID):
        """
        获取段落关联的关键词信息
        """
        links = await KeywordMapper.get_links_by_paragraph_id(db, paragraph_id)
        
        related_keywords = []
        for link in links:
            keyword = await KeywordMapper.get_keyword_by_id(db, link.keyword_id)
            if keyword:
                related_keywords.append({
                    "keyword_id": keyword.keyword_id,
                    "document_id": keyword.document_id,
                    "keyword": keyword.keyword,
                    "created_at": keyword.created_at,
                    "updated_at": keyword.updated_at
                })
        
        return related_keywords

    @staticmethod
    async def ai_assist_keyword(db: AsyncSession, document_id: UUID):
        """
        AI 帮填关键词
        """
        # 获取文档信息
        from db.mappers.document_mapper import DocumentMapper
        document = await DocumentMapper.get_document_by_id(db, document_id)
        if not document:
            return []
        
        # 渲染提示词
        from services.prompt_templates import render_prompt, system_prompts
        prompt = render_prompt(
            "extract_keywords",
            title=document.title,
            abstract=document.abstract,
            purpose=document.purpose
        )
        
        response = ""
        async for chunk in call_qwen_stream(
            system_prompts["extract_keywords"],
            [],
            prompt
        ):
            response += chunk
        
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
            keyword_in = DocumentKeywordCreate(
                document_id=document_id,
                keyword=keyword
            )
            new_keyword = await KeywordService.create_keyword(db, keyword_in)
            saved_keywords.append({
                "keyword_id": new_keyword.keyword_id,
                "document_id": new_keyword.document_id,
                "keyword": new_keyword.keyword,
                "created_at": new_keyword.created_at,
                "updated_at": new_keyword.updated_at
            })
        
        return saved_keywords
