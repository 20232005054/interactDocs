"""
文档导出接口

GET /api/v1/documents/{document_id}/export/docx   → Word 文件
GET /api/v1/documents/{document_id}/export/pdf    → PDF 文件
GET /api/v1/documents/{document_id}/export/md     → Markdown 文本
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from services.export_service import export_docx, export_pdf, export_markdown

router = APIRouter(prefix="/api/v1/documents", tags=["文档导出"])


@router.get("/{document_id}/export/docx", summary="导出为 Word 文档")
async def export_document_docx(document_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        content = await export_docx(db, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {e}")
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=\"document_{document_id}.docx\""},
    )


@router.get("/{document_id}/export/pdf", summary="导出为 PDF")
async def export_document_pdf(document_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        content = await export_pdf(db, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {e}")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"document_{document_id}.pdf\""},
    )


@router.get("/{document_id}/export/md", summary="导出为 Markdown")
async def export_document_markdown(document_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        content = await export_markdown(db, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {e}")
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"document_{document_id}.md\""},
    )
