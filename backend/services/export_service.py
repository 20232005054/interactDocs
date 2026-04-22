"""
文档导出服务

支持格式：Word (.docx)、PDF、Markdown

内容解析器 parse_content 是唯一需要在前端确定富文本格式后修改的地方：
- 当前：原样输出（占位）
- 前端用 HTML 时：用 BeautifulSoup 提取纯文本
- 前端用 Markdown 时：用 markdown 库转 HTML 再提取纯文本
"""

import io
import re
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.models import Chapter, Paragraph, DocumentSummary, Document


# ---------------------------------------------------------------------------
# 内容解析器（前端格式确定后替换此函数）
# ---------------------------------------------------------------------------

def parse_content(content: str) -> str:
    """将 HTML 富文本内容转为纯文本，供 Word/Markdown 导出使用"""
    if not content:
        return ""
    from bs4 import BeautifulSoup
    return BeautifulSoup(content, "html.parser").get_text("\n").strip()


def extract_image_urls(content: str) -> list[str]:
    """从 HTML 内容中提取图片 URL"""
    if not content:
        return []
    return re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content)


# ---------------------------------------------------------------------------
# 文档数据组装（格式无关）
# ---------------------------------------------------------------------------

async def _build_references(db: AsyncSession, document_id: UUID) -> list[dict]:
    """获取文档参考文献列表，格式化为温哥华引文"""
    try:
        from services.literature_rag_service import LiteratureRagService
        citations = await LiteratureRagService.get_document_reference_list(db, document_id)
        return [
            {
                "number": c["citation_number"],
                "formatted": LiteratureRagService.format_vancouver_reference(c, c["citation_number"]),
            }
            for c in citations
        ]
    except Exception:
        return []


async def build_document_data(db: AsyncSession, document_id: UUID) -> dict:
    """组装文档完整数据，返回格式无关的中间结构"""
    # 文档基本信息
    doc_result = await db.execute(select(Document).where(Document.document_id == document_id))
    document = doc_result.scalar_one_or_none()
    if not document:
        return None

    # 摘要
    summaries_result = await db.execute(
        select(DocumentSummary)
        .where(DocumentSummary.document_id == document_id)
        .order_by(DocumentSummary.order_index)
    )
    summaries = summaries_result.scalars().all()

    # 章节（全部加载，在内存中构建树）
    chapters_result = await db.execute(
        select(Chapter)
        .where(Chapter.document_id == document_id)
        .order_by(Chapter.order_index)
    )
    chapters = chapters_result.scalars().all()

    # 段落（批量加载）
    chapter_ids = [c.chapter_id for c in chapters]
    paragraphs_result = await db.execute(
        select(Paragraph)
        .where(Paragraph.chapter_id.in_(chapter_ids))
        .order_by(Paragraph.chapter_id, Paragraph.order_index)
    )
    paragraphs = paragraphs_result.scalars().all()

    # 按 chapter_id 分组段落
    para_map: dict[UUID, list] = {}
    for p in paragraphs:
        para_map.setdefault(p.chapter_id, []).append(p)

    # 构建章节树
    chapter_map = {c.chapter_id: c for c in chapters}

    def build_chapter_node(chapter: Chapter, level: int) -> dict:
        return {
            "chapter_id": str(chapter.chapter_id),
            "parent_id": str(chapter.parent_id) if chapter.parent_id else None,
            "title": chapter.title,
            "order_index": chapter.order_index,
            "level": level,
            "paragraphs": [
                {
                    "content": p.content,
                    "para_type": p.para_type,
                    "order_index": p.order_index,
                }
                for p in para_map.get(chapter.chapter_id, [])
            ],
            "children": [],
        }

    # 先建所有节点
    nodes = {c.chapter_id: build_chapter_node(c, 1) for c in chapters}

    # 计算层级并构建树
    root_chapters = []
    for chapter in chapters:
        node = nodes[chapter.chapter_id]
        if chapter.parent_id and chapter.parent_id in nodes:
            parent_node = nodes[chapter.parent_id]
            node["level"] = parent_node["level"] + 1
            parent_node["children"].append(node)
        else:
            root_chapters.append(node)

    return {
        "title": document.title,
        "purpose": document.purpose or "",
        "summaries": [
            {"title": s.title, "content": s.content}
            for s in summaries
        ],
        "chapters": root_chapters,
        "references": await _build_references(db, document_id),
    }


# ---------------------------------------------------------------------------
# Word 导出
# ---------------------------------------------------------------------------

def _set_run_font(run, font_name: str = "宋体"):
    """为 run 设置中文字体，避免中文显示为方块"""
    from docx.oxml.ns import qn
    from lxml import etree
    run.font.name = font_name
    # 必须同时设置 eastAsia 字体，python-docx 默认不设置
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = etree.SubElement(rPr, qn("w:rFonts"))
    rFonts.set(qn("w:eastAsia"), font_name)


async def export_docx(db: AsyncSession, document_id: UUID) -> bytes:
    """生成 Word 文档，返回二进制内容"""
    from docx import Document as DocxDocument
    from docx.shared import Inches
    import httpx

    data = await build_document_data(db, document_id)
    if not data:
        raise ValueError("文档不存在")

    doc = DocxDocument()
    title_heading = doc.add_heading(data["title"], level=0)
    for run in title_heading.runs:
        _set_run_font(run)

    if data["purpose"]:
        p = doc.add_paragraph()
        _set_run_font(p.add_run(f"用途：{data['purpose']}"))

    # 摘要部分
    if data["summaries"]:
        summary_heading = doc.add_heading("摘要信息", level=1)
        for run in summary_heading.runs:
            _set_run_font(run)
        for s in data["summaries"]:
            p = doc.add_paragraph()
            run_title = p.add_run(f"{s['title']}：")
            run_title.bold = True
            _set_run_font(run_title)
            _set_run_font(p.add_run(parse_content(s["content"])))

    # 章节递归写入
    def write_chapter(chapter: dict):
        level = min(chapter["level"], 9)
        heading = doc.add_heading(chapter["title"], level=level)
        for run in heading.runs:
            _set_run_font(run)

        for para in chapter["paragraphs"]:
            content = para["content"] or ""
            para_type = para.get("para_type", "paragraph")

            if para_type in ("heading1", "heading2", "heading3"):
                h_level = int(para_type[-1])
                h = doc.add_heading(content, level=h_level)
                for run in h.runs:
                    _set_run_font(run)
                continue

            # paragraph 类型
            text = parse_content(content)
            img_urls = extract_image_urls(content)
            if img_urls:
                for url in img_urls:
                    try:
                        resp = httpx.get(url, timeout=10)
                        if resp.status_code == 200:
                            doc.add_picture(io.BytesIO(resp.content), width=Inches(5))
                    except Exception:
                        pass
                if text.strip():
                    p = doc.add_paragraph()
                    _set_run_font(p.add_run(text))
            else:
                if text.strip():
                    p = doc.add_paragraph()
                    _set_run_font(p.add_run(text))

        for child in chapter.get("children", []):
            write_chapter(child)

    for chapter in data["chapters"]:
        write_chapter(chapter)

    # 参考文献列表
    if data.get("references"):
        ref_heading = doc.add_heading("参考文献", level=1)
        for run in ref_heading.runs:
            _set_run_font(run)
        for ref in data["references"]:
            p = doc.add_paragraph()
            _set_run_font(p.add_run(ref["formatted"]))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# PDF 导出
# ---------------------------------------------------------------------------

async def export_pdf(db: AsyncSession, document_id: UUID) -> bytes:
    """生成 PDF，返回二进制内容（weasyprint 自动处理图片 URL）"""
    import weasyprint

    data = await build_document_data(db, document_id)
    if not data:
        raise ValueError("文档不存在")

    def chapter_to_html(chapter: dict) -> str:
        level = min(chapter["level"] + 1, 6)
        html = f"<h{level}>{chapter['title']}</h{level}>\n"
        for para in chapter["paragraphs"]:
            content = para["content"] or ""
            para_type = para.get("para_type", "paragraph")
            if para_type in ("heading1", "heading2", "heading3"):
                h_level = int(para_type[-1])
                html += f"<h{h_level}>{content}</h{h_level}>\n"
            else:
                html += f"<p>{content}</p>\n"
        for child in chapter.get("children", []):
            html += chapter_to_html(child)
        return html

    summaries_html = ""
    if data["summaries"]:
        summaries_html = "<h2>摘要信息</h2>\n<table border='1' cellpadding='6'>\n"
        for s in data["summaries"]:
            summaries_html += f"<tr><td><b>{s['title']}</b></td><td>{s['content']}</td></tr>\n"
        summaries_html += "</table>\n"

    chapters_html = "".join(chapter_to_html(c) for c in data["chapters"])

    references_html = ""
    if data.get("references"):
        references_html = "<h2>参考文献</h2>\n<ol>\n"
        for ref in data["references"]:
            references_html += f"<li>{ref['formatted']}</li>\n"
        references_html += "</ol>\n"

    full_html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body {{ font-family: 'SimSun', serif; font-size: 12pt; margin: 2cm; }}
  h1 {{ font-size: 18pt; }} h2 {{ font-size: 15pt; }} h3 {{ font-size: 13pt; }}
  table {{ border-collapse: collapse; width: 100%; }}
  td {{ padding: 6px; }}
</style>
</head><body>
<h1>{data['title']}</h1>
{summaries_html}
{chapters_html}
{references_html}
</body></html>"""

    pdf_bytes = weasyprint.HTML(string=full_html).write_pdf()
    return pdf_bytes


# ---------------------------------------------------------------------------
# Markdown 导出
# ---------------------------------------------------------------------------

async def export_markdown(db: AsyncSession, document_id: UUID) -> str:
    """生成 Markdown 文本"""
    data = await build_document_data(db, document_id)
    if not data:
        raise ValueError("文档不存在")

    lines = [f"# {data['title']}\n"]

    if data["purpose"]:
        lines.append(f"> 用途：{data['purpose']}\n")

    if data["summaries"]:
        lines.append("## 摘要信息\n")
        for s in data["summaries"]:
            content = s["content"] or ""
            img_urls = extract_image_urls(content)
            img_md = "".join(f"![image]({url})" for url in img_urls)
            lines.append(f"**{s['title']}**：{parse_content(content)}{img_md}\n")

    def chapter_to_md(chapter: dict) -> list[str]:
        prefix = "#" * min(chapter["level"] + 1, 6)
        result = [f"{prefix} {chapter['title']}\n"]
        for para in chapter["paragraphs"]:
            content = para["content"] or ""
            para_type = para.get("para_type", "paragraph")
            if para_type in ("heading1", "heading2", "heading3"):
                h_level = int(para_type[-1])
                result.append(f"{'#' * h_level} {content}\n")
            else:
                img_urls = extract_image_urls(content)
                for url in img_urls:
                    result.append(f"![image]({url})\n")
                text = parse_content(content)
                if text.strip():
                    result.append(f"{text}\n")
        for child in chapter.get("children", []):
            result.extend(chapter_to_md(child))
        return result

    for chapter in data["chapters"]:
        lines.extend(chapter_to_md(chapter))

    if data.get("references"):
        lines.append("\n## 参考文献\n")
        for ref in data["references"]:
            lines.append(f"{ref['formatted']}\n")

    return "\n".join(lines)
