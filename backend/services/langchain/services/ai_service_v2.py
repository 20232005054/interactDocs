"""
AI 辅助编辑服务 v2

使用 LangChain 框架重新实现，提供与原服务相同的接口
"""

import logging
from typing import AsyncGenerator, Optional
from uuid import UUID

from services.langchain.core.session_adapter import SessionAdapter, load_document_context
from services.langchain.chains.generation_chain import (
    create_paragraph_generation_chain,
    create_summary_generation_chain,
)
from services.langchain.chains.evaluation_chain import create_quality_evaluation_chain

logger = logging.getLogger(__name__)


class AIServiceV2:
    """
    AI 辅助编辑服务 v2
    
    使用 LangChain 框架实现：
    - ParagraphGenerationChain 生成段落
    - SummaryGenerationChain 生成摘要
    - QualityEvaluationChain 评估质量
    """
    
    @staticmethod
    async def ai_assist_paragraph(
        paragraph_id: UUID,
        assist_request=None,
        upstream_summary: dict = None,
        instruction: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        AI 帮填段落内容（流式）
        
        Args:
            paragraph_id: 段落 ID
            assist_request: 帮填请求参数（保留兼容）
            upstream_summary: 上游摘要变更时传入
            instruction: 用户修改意见（可选）
        
        Yields:
            SSE 格式的数据流
        """
        import json
        
        # 阶段 1：准备数据
        try:
            async with SessionAdapter.query_session() as db:
                # 加载段落上下文
                from db.mappers.paragraph_mapper import ParagraphMapper
                from db.mappers.chapter_mapper import ChapterMapper
                
                paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
                if not paragraph:
                    yield f"data: {json.dumps({'error': '段落不存在'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                
                chapter = await ChapterMapper.get_chapter_by_id(db, paragraph.chapter_id)
                if not chapter:
                    yield f"data: {json.dumps({'error': '章节不存在'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                
                # 加载文档上下文
                context = await load_document_context(
                    db,
                    chapter.document_id,
                    chapter_id=chapter.chapter_id,
                )
        
        except Exception as e:
            logger.error(f"[AI帮填v2] 准备阶段失败: {e}")
            yield f"data: {json.dumps({'error': f'准备阶段失败: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        # 阶段 2：流式生成
        try:
            chain = create_paragraph_generation_chain()
            
            # 准备输入
            input_data = {
                "document_context": context,
                "chapter_title": chapter.title,
                "current_content": paragraph.content or "",
                "requirements": instruction or "",
            }
            
            # 如果有上游摘要变更
            if upstream_summary:
                input_data["upstream_summary"] = upstream_summary
            
            # 流式生成
            full_content = ""
            async for chunk in chain.astream(input_data):
                if "content" in chunk:
                    content_chunk = chunk["content"]
                    full_content += content_chunk
                    yield f"data: {json.dumps({'content': content_chunk})}\n\n"
        
        except Exception as e:
            logger.error(f"[AI帮填v2] 生成阶段失败: {e}")
            yield f"data: {json.dumps({'error': f'AI 生成失败: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        # 阶段 3：保存结果
        try:
            async with SessionAdapter.save_session() as db:
                from db.mappers.paragraph_mapper import ParagraphMapper
                
                await ParagraphMapper.update_paragraph(
                    db,
                    paragraph_id,
                    {
                        "ai_generate": full_content,
                        "ai_instruction": instruction,
                    }
                )
                await db.commit()
                
                logger.info(
                    f"[AI帮填v2] 完成 paragraph_id={paragraph_id} "
                    f"content_len={len(full_content)}"
                )
        
        except Exception as e:
            logger.error(f"[AI帮填v2] 保存阶段失败: {e}")
        
        yield "data: [DONE]\n\n"
    
    @staticmethod
    def ai_evaluate_paragraph(paragraph_id: UUID) -> AsyncGenerator[str, None]:
        """
        AI 评估段落内容（流式）
        
        Args:
            paragraph_id: 段落 ID
        
        Returns:
            异步生成器工厂
        """
        async def evaluate_and_save():
            import json
            
            # 阶段 1：准备数据
            try:
                async with SessionAdapter.query_session() as db:
                    from db.mappers.paragraph_mapper import ParagraphMapper
                    from db.mappers.chapter_mapper import ChapterMapper
                    
                    paragraph = await ParagraphMapper.get_paragraph_by_id(db, paragraph_id)
                    if not paragraph:
                        yield f"data: {json.dumps({'error': '段落不存在'})}\n\n"
                        return
                    
                    if not paragraph.content or not paragraph.content.strip():
                        yield f"data: {json.dumps({'error': '段落内容为空，无法评估'})}\n\n"
                        return
                    
                    chapter = await ChapterMapper.get_chapter_by_id(db, paragraph.chapter_id)
                    if not chapter:
                        yield f"data: {json.dumps({'error': '章节不存在'})}\n\n"
                        return
                    
                    # 加载文档上下文
                    context = await load_document_context(
                        db,
                        chapter.document_id,
                        chapter_id=chapter.chapter_id,
                    )
            
            except Exception as e:
                logger.error(f"[AI评估v2] 准备阶段失败: {e}")
                yield f"data: {json.dumps({'error': f'准备阶段失败: {str(e)}'})}\n\n"
                return
            
            # 阶段 2：流式评估
            try:
                chain = create_quality_evaluation_chain()
                
                # 准备输入
                input_data = {
                    "content": paragraph.content,
                    "document_context": context,
                }
                
                # 流式评估
                full_evaluation = ""
                async for chunk in chain.astream(input_data):
                    if "content" in chunk:
                        content_chunk = chunk["content"]
                        full_evaluation += content_chunk
                        yield f"data: {json.dumps({'content': content_chunk})}\n\n"
                
                # 解析评估结果
                evaluation_result = full_evaluation
                suggestions = []
                
                if "改进建议" in full_evaluation:
                    parts = full_evaluation.split("改进建议", 1)
                    evaluation_result = parts[0].strip()
                    for line in parts[1].strip().split("\n"):
                        line = line.strip()
                        if line:
                            suggestions.append(line)
            
            except Exception as e:
                logger.error(f"[AI评估v2] 评估阶段失败: {e}")
                yield f"data: {json.dumps({'error': f'AI 评估失败: {str(e)}'})}\n\n"
                return
            
            # 阶段 3：保存结果
            try:
                async with SessionAdapter.save_session() as db:
                    from db.mappers.paragraph_mapper import ParagraphMapper
                    
                    await ParagraphMapper.update_paragraph(
                        db,
                        paragraph_id,
                        {
                            "ai_eval": evaluation_result,
                            "ai_suggestion": "\n".join(suggestions) if suggestions else full_evaluation,
                        }
                    )
                    await db.commit()
                    
                    logger.info(f"[AI评估v2] 完成 paragraph_id={paragraph_id}")
            
            except Exception as e:
                logger.error(f"[AI评估v2] 保存阶段失败: {e}")
            
            yield f"data: {json.dumps({'evaluation': evaluation_result, 'suggestions': suggestions})}\n\n"
            yield "data: [DONE]\n\n"
        
        return evaluate_and_save
    
    @staticmethod
    async def assist_single_summary(
        summary_id: UUID,
        downstream_paragraph: dict = None,
    ) -> Optional[str]:
        """
        AI 帮填单个摘要（非流式，供后台任务调用）
        
        Args:
            summary_id: 摘要 ID
            downstream_paragraph: 下游段落变更时传入
        
        Returns:
            生成的摘要内容
        """
        try:
            # 加载摘要上下文
            async with SessionAdapter.query_session() as db:
                from db.mappers.summary_mapper import SummaryMapper
                from db.mappers.document_mapper import DocumentMapper
                
                summary = await SummaryMapper.get_summary_by_id(db, summary_id)
                if not summary:
                    return None
                
                document = await DocumentMapper.get_document_by_id(db, summary.document_id)
                if not document:
                    return None
                
                # 加载文档上下文
                context = await load_document_context(db, document.document_id)
            
            # 生成摘要
            chain = create_summary_generation_chain()
            
            # 准备输入
            input_data = {
                "document_context": context,
                "summary_title": summary.title,
                "current_content": summary.content or "",
            }
            
            # 如果有下游段落变更
            if downstream_paragraph:
                input_data["downstream_paragraph"] = downstream_paragraph
            
            # 生成
            result = await chain.ainvoke(input_data)
            new_content = result.get("content", "").strip()
            
            # 保存结果
            if new_content:
                async with SessionAdapter.save_session() as db:
                    from db.mappers.summary_mapper import SummaryMapper
                    
                    await SummaryMapper.update_summary(
                        db,
                        summary_id,
                        {
                            "ai_generate": new_content,
                            "is_change": 3,
                        }
                    )
                    await db.commit()
                    
                    logger.info(
                        f"[AI帮填摘要v2] 完成 summary_id={summary_id} "
                        f"content_len={len(new_content)}"
                    )
            
            return new_content
        
        except Exception as e:
            logger.error(f"[AI帮填摘要v2] 失败: {e}")
            return None
