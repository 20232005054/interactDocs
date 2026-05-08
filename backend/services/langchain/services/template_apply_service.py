"""
模板应用服务

使用 LangChain 框架实现模板应用功能
"""

import logging
from typing import List, Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from services.langchain.workflows.document_generation import create_document_generation_workflow

logger = logging.getLogger(__name__)


class TemplateApplyService:
    """
    模板应用服务
    
    使用 LangChain 框架实现：
    - DocumentGenerationWorkflow 文档生成工作流
    - 支持核心信息、摘要、结构模板应用
    """
    
    @staticmethod
    async def apply_core_info_template(
        db: AsyncSession,
        document_id: UUID,
    ) -> List[Any]:
        """
        应用核心信息模板
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
        
        Returns:
            创建的核心信息列表
        """
        try:
            # 获取文档模板 ID
            from db.mappers.document_mapper import DocumentMapper
            document = await DocumentMapper.get_document_by_id(db, document_id)
            if not document:
                raise ValueError("文档不存在")
            
            # 使用工作流
            workflow = await create_document_generation_workflow(
                document_id=document_id,
                template_id=document.template_id,
                generate_mode="core_only",
            )
            
            result = await workflow.run()
            
            logger.info(
                f"[模板应用v2-核心信息] 完成 document_id={document_id} "
                f"count={result.get('core_info_count', 0)}"
            )
            
            # 返回创建的核心信息（兼容原接口）
            from db.mappers.core_info_mapper import CoreInfoMapper
            return await CoreInfoMapper.get_core_info_by_document_id(db, document_id)
        
        except Exception as e:
            logger.error(f"[模板应用v2-核心信息] 失败: {e}")
            raise
    
    @staticmethod
    async def apply_core_info_template_as_tree(
        db: AsyncSession,
        document_id: UUID,
    ) -> tuple:
        """
        应用核心信息模板并返回树形结构
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
        
        Returns:
            (tree, count)
        """
        try:
            # 应用模板
            items = await TemplateApplyService.apply_core_info_template(db, document_id)
            
            # 构建树形结构（复用原逻辑）
            from schemas.response_schemas import ApplyCoreInfoItem
            
            info_dict_map = {}
            for item in items:
                info_dict_map[item.core_info_id] = ApplyCoreInfoItem(
                    core_info_id=str(item.core_info_id),
                    parent_id=str(item.parent_id) if item.parent_id else None,
                    title=item.title,
                    field_key=item.field_key,
                    field_type=item.field_type,
                    content=item.content,
                    order_index=item.order_index,
                    is_locked=item.is_locked,
                    is_required=item.is_required,
                    is_change=item.is_change,
                    children=[]
                )
            
            tree = []
            for item in items:
                node = info_dict_map[item.core_info_id]
                if item.parent_id and item.parent_id in info_dict_map:
                    info_dict_map[item.parent_id].children.append(node)
                else:
                    tree.append(node)
            
            # 递归排序
            def sort_tree(nodes):
                nodes.sort(key=lambda x: x.order_index)
                for n in nodes:
                    if n.children:
                        sort_tree(n.children)
            
            sort_tree(tree)
            
            return tree, len(items)
        
        except Exception as e:
            logger.error(f"[模板应用v2-核心信息树] 失败: {e}")
            raise
    
    @staticmethod
    async def apply_summary_template(
        db: AsyncSession,
        document_id: UUID,
    ) -> List[Dict]:
        """
        应用摘要模板
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
        
        Returns:
            创建的摘要列表
        """
        try:
            # 获取文档模板 ID
            from db.mappers.document_mapper import DocumentMapper
            document = await DocumentMapper.get_document_by_id(db, document_id)
            if not document:
                raise ValueError("文档不存在")
            
            # 使用工作流
            workflow = await create_document_generation_workflow(
                document_id=document_id,
                template_id=document.template_id,
                generate_mode="summary_only",
            )
            
            result = await workflow.run()
            
            logger.info(
                f"[模板应用v2-摘要] 完成 document_id={document_id} "
                f"count={result.get('summary_count', 0)}"
            )
            
            # 返回创建的摘要（兼容原接口）
            from db.mappers.summary_mapper import SummaryMapper
            summaries = await SummaryMapper.get_summaries_by_document_id(db, document_id)
            
            return [
                {
                    "summary": s,
                    "template_id": None,
                    "generation_mode": 1,
                    "sources": [],
                    "degraded": False,
                    "generation_error": None,
                }
                for s in summaries
            ]
        
        except Exception as e:
            logger.error(f"[模板应用v2-摘要] 失败: {e}")
            raise
    
    @staticmethod
    async def apply_structure_template(
        db: AsyncSession,
        document_id: UUID,
    ) -> List[Dict]:
        """
        应用章节结构模板
        
        Args:
            db: 数据库会话
            document_id: 文档 ID
        
        Returns:
            创建的章节列表
        """
        try:
            # 获取文档模板 ID
            from db.mappers.document_mapper import DocumentMapper
            document = await DocumentMapper.get_document_by_id(db, document_id)
            if not document:
                raise ValueError("文档不存在")
            
            # 使用工作流
            workflow = await create_document_generation_workflow(
                document_id=document_id,
                template_id=document.template_id,
                generate_mode="structure_only",
            )
            
            result = await workflow.run()
            
            logger.info(
                f"[模板应用v2-结构] 完成 document_id={document_id} "
                f"chapter_count={result.get('chapter_count', 0)} "
                f"paragraph_count={result.get('paragraph_count', 0)}"
            )
            
            # 返回创建的章节（兼容原接口）
            from db.mappers.chapter_mapper import ChapterMapper
            from db.mappers.paragraph_mapper import ParagraphMapper
            
            chapters = await ChapterMapper.get_chapters_by_document_id(db, document_id)
            
            result_items = []
            for chapter in chapters:
                paragraphs = await ParagraphMapper.get_paragraphs_by_chapter_id(
                    db, chapter.chapter_id
                )
                
                result_items.append({
                    "chapter": chapter,
                    "template": None,
                    "paragraphs": paragraphs,
                    "degraded": False,
                    "generation_error": None,
                })
            
            return result_items
        
        except Exception as e:
            logger.error(f"[模板应用v2-结构] 失败: {e}")
            raise
