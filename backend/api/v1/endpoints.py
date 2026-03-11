from core.response import T
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import re
from db.session import get_db
from db.models import Document, Chapter, OperationHistory, DocumentVersion, Template
from schemas.schemas import DocumentCreate, DocumentUpdate, ChapterUpdate, MetadataConfig, DocumentVersionCreate
from core.response import success_response

router = APIRouter(prefix="/api/v1")


# --- 元数据管理模块 ---

@router.get("/metadata/generate")
async def get_generate_metadata(db: AsyncSession = Depends(get_db)):
    """
    获取生成方案的元数据配置
    """
    # 从template表中获取所有不同的purpose值
    result = await db.execute(select(Template.purpose).distinct())
    purposes = [row[0] for row in result.all()]
    
    # 如果没有目的类型，使用默认值
    if not purposes:
        purposes = ["通用", "医疗器械临床申报", "药物临床试验", "学术研究", "其他"]
    
    metadata = {
        "generateType": "scheme_gc",
        "title": "方案生成",
        "fields": [
            {
                "field": "title",
                "label": "方案标题",
                "type": "input",
                "required": True
            },
            {
                "field": "keywords",
                "label": "关键词",
                "type": "input",
                "required": False
            },
            {
                "field": "abstract",
                "label": "正文摘要",
                "type": "textarea",
                "required": False
            },
            {
                "field": "content",
                "label": "参考正文",
                "type": "textarea",
                "required": True
            }
            ,
            {
                "field": "purpose",
                "label": "使用目的",
                "type": "select",
                "options": purposes,
                "required": True
            }
        ]
    }
    return success_response(data=metadata)


# # --- 文档管理模块 ---

# @router.post("/documents")
# async def create_document(doc_in: DocumentCreate, db: AsyncSession = Depends(get_db)):
#     # 临时模拟 user_id (因为跳过了 JWT)
#     new_doc = Document(
#         title=doc_in.title,
#         keywords=doc_in.keywords,
#         abstract=doc_in.abstract,
#         content=doc_in.content,
#         purpose=doc_in.purpose,
#         status="draft"
#     )
#     db.add(new_doc)
#     await db.commit()
#     await db.refresh(new_doc)
#     return success_response(data=new_doc)  # 返回模型会自动映射到 VO


# @router.get("/documents/{document_id}")
# async def get_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(Document).where(Document.document_id == document_id))
#     doc = result.scalar_one_or_none()
#     if not doc:
#         raise HTTPException(status_code=404, detail="文档不存在")
#     return success_response(data=doc)


# @router.post("/documents/{document_id}/generate")
# async def generate_schema(document_id: UUID, db: AsyncSession = Depends(get_db)):
#     # 1. 检查文档是否存在
#     doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
#     if not doc_result.scalar_one_or_none():
#         raise HTTPException(status_code=404, detail="文档不存在")

#     # 2. 预设核心章节结构
#     preset_chapters = [
#         {"title": "项目核心信息", "order_index": 1},
#         {"title": "方案摘要", "order_index": 2},
#         {"title": "方案全文", "order_index": 3}
#     ]

#     created_chapters = []
#     for idx, item in enumerate(preset_chapters):
#         ch = Chapter(
#             document_id=document_id,
#             title=item["title"],
#             order_index=item["order_index"],
#             status="pending"
#         )
#         db.add(ch)
#         created_chapters.append(ch)

#     await db.commit()
#     return success_response(message="生成成功", data={"chapters": preset_chapters})


# # --- 章节管理模块 ---

# @router.get("/documents/{document_id}/chapters")
# async def list_chapters(document_id: UUID, db: AsyncSession = Depends(get_db)):
#     # 按 order_index 排序获取所有章节
#     result = await db.execute(
#         select(Chapter)
#         .where(Chapter.document_id == document_id)
#         .order_by(Chapter.order_index.asc())
#     )
#     chapters = result.scalars().all()
#     return success_response(data={"chapters": chapters})


# @router.get("/chapters/{chapter_id}")
# async def get_chapter_detail(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(Chapter).where(Chapter.chapter_id == chapter_id))
#     chapter = result.scalar_one_or_none()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="章节不存在")
#     return success_response(data=chapter)


# --- 辅助功能模块 ---

@router.get("/history", summary="获取操作历史记录")
async def get_operation_history(page: int = 1, page_size: int = 10, db: AsyncSession = Depends(get_db)):
    """
    获取操作历史记录
    """
    # 查询操作历史总数
    count_result = await db.execute(select(OperationHistory))
    total = len(count_result.scalars().all())
    
    # 分页查询操作历史
    offset = (page - 1) * page_size
    result = await db.execute(
        select(OperationHistory)
        .order_by(OperationHistory.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    history = result.scalars().all()
    
    # 构建返回数据
    items = []
    for item in history:
        items.append({
            "history_id": item.history_id,
            "chapter_id": item.chapter_id,
            "document_id": item.document_id,
            "user_id": item.user_id,
            "action": item.action,
            "content_before": item.content_before,
            "content_after": item.content_after,
            "created_at": item.created_at
        })
    
    return success_response(data={"total": total, "items": items})


