"""
文献上传与处理服务

流程：
1. 接收 PDF 文件 → 上传 OSS → 创建 literature 记录（pending）
2. 后台异步任务：
   a. PyPDFLoader 解析 PDF
   b. 按章节关键词打 section_type 标签
   c. RecursiveCharacterTextSplitter 分块
   d. DashScope embedding 向量化
   e. 批量写入 literature_chunks
   f. 正则提取 DOI → CrossRef API 补全 metadata
   g. upload_status = ready
"""

import asyncio
import logging
import re
from uuid import UUID, uuid4

import httpx
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.utils import log_task_exception
from db.mappers.literature_mapper import LiteratureMapper
from db.mappers.literature_chunk_mapper import LiteratureChunkMapper
from db.models import Literature, LiteratureChunk
from db.session import AsyncSessionLocal
from services.ai_client import get_embedding
from services.oss_service import build_url, upload_file, delete_file, read_file

logger = logging.getLogger(__name__)

# 分块配置
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# 章节类型关键词映射（英文学术论文常见标题）
SECTION_KEYWORDS: dict[str, list[str]] = {
    "abstract":    ["abstract", "摘要", "summary"],
    "intro":       ["introduction", "background", "引言", "背景"],
    "method":      ["method", "material", "methodology", "methods", "方法", "材料"],
    "result":      ["result", "finding", "结果", "发现"],
    "conclusion":  ["conclusion", "discussion", "讨论", "结论", "总结"],
}

# PDF 文件大小限制 30MB
MAX_PDF_SIZE = 30 * 1024 * 1024


def _detect_section_type(text: str) -> str:
    """根据文本内容猜测章节类型"""
    text_lower = text.lower()
    for section, keywords in SECTION_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return section
    return "other"


def _extract_doi(text: str) -> str | None:
    """从文本中提取 DOI"""
    pattern = r'\b10\.\d{4,9}/[^\s"\'<>]+\b'
    match = re.search(pattern, text)
    return match.group(0).rstrip(".,;)") if match else None


async def _fetch_crossref_metadata(doi: str) -> dict:
    """通过 CrossRef API 获取文献 metadata"""
    url = f"https://api.crossref.org/works/{doi}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "InteractiveDocs/1.0"})
            if resp.status_code != 200:
                return {}
            data = resp.json().get("message", {})
            # 提取作者
            authors_list = data.get("author", [])
            authors = ", ".join(
                f"{a.get('family', '')} {a.get('given', '')}".strip()
                for a in authors_list[:5]  # 最多取前5位作者
            )
            # 提取期刊
            journal = ""
            container = data.get("container-title", [])
            if container:
                journal = container[0]
            # 提取发表日期
            publish_date = None
            date_parts = data.get("published", {}).get("date-parts", [[]])
            if date_parts and date_parts[0]:
                parts = date_parts[0]
                try:
                    from datetime import date
                    y = parts[0] if len(parts) > 0 else 2000
                    m = parts[1] if len(parts) > 1 else 1
                    d = parts[2] if len(parts) > 2 else 1
                    publish_date = date(y, m, d)
                except Exception:
                    pass
            # 提取标题
            title = ""
            titles = data.get("title", [])
            if titles:
                title = titles[0]
            return {
                "title": title or None,
                "authors": authors or None,
                "journal": journal or None,
                "publish_date": publish_date,
            }
    except Exception as e:
        logger.warning("CrossRef API 调用失败 doi=%s: %s", doi, e)
        return {}


async def _process_literature_async(literature_id: UUID, file_path: str) -> None:
    """
    后台任务：解析 PDF → 向量化 → 写入 chunks → 补全 metadata
    file_path 为本地临时文件路径，处理完后删除
    """
    import os
    try:
        async with AsyncSessionLocal() as db:
            await LiteratureMapper.update_status(db, literature_id, "processing")
            await db.commit()

        # 1. 解析 PDF
        logger.info("[文献处理] 开始解析 literature_id=%s", literature_id)
        pages = await asyncio.to_thread(
            lambda: PyPDFLoader(file_path).load()
        )
        if not pages:
            raise ValueError("PDF 解析结果为空")

        full_text = "\n".join(p.page_content for p in pages)

        # 2. 分块
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", "。", ".", " ", ""],
        )
        docs = splitter.create_documents([full_text])
        if not docs:
            raise ValueError("文本分块结果为空")

        # 3. 向量化 + 写入 chunks
        chunks: list[LiteratureChunk] = []
        for idx, doc in enumerate(docs):
            content = doc.page_content.strip()
            if not content:
                continue
            embedding = await get_embedding(content)
            section_type = _detect_section_type(content)
            chunks.append(LiteratureChunk(
                literature_id=literature_id,
                section_type=section_type,
                content=content,
                embedding=str(embedding),   # 暂存为字符串，写入时转换
                chunk_index=idx,
            ))

        # 批量写入（使用原生 SQL 写入 vector 类型）
        async with AsyncSessionLocal() as db:
            for chunk in chunks:
                from sqlalchemy import text
                await db.execute(
                    text("""
                        INSERT INTO literature_chunks
                            (chunk_id, literature_id, section_type, content, embedding, chunk_index)
                        VALUES
                            (:chunk_id, :literature_id, :section_type, :content, :embedding ::vector, :chunk_index)
                    """),
                    {
                        "chunk_id": str(uuid4()),
                        "literature_id": str(literature_id),
                        "section_type": chunk.section_type,
                        "content": chunk.content,
                        "embedding": chunk.embedding,
                        "chunk_index": chunk.chunk_index,
                    }
                )
            await db.commit()
        logger.info("[文献处理] 写入 %d 个分块 literature_id=%s", len(chunks), literature_id)

        # 4. 提取 DOI，补全 metadata
        doi = _extract_doi(full_text)
        metadata_update: dict = {}
        if doi:
            logger.info("[文献处理] 提取到 DOI=%s，调用 CrossRef", doi)
            crossref_data = await _fetch_crossref_metadata(doi)
            metadata_update = {k: v for k, v in crossref_data.items() if v is not None}
            metadata_update["doi"] = doi

        async with AsyncSessionLocal() as db:
            if metadata_update:
                await LiteratureMapper.update_metadata(db, literature_id, metadata_update)
            await LiteratureMapper.update_status(db, literature_id, "ready")
            await db.commit()

        logger.info("[文献处理] 完成 literature_id=%s doi=%s", literature_id, doi)

    except Exception as e:
        logger.error("[文献处理] 失败 literature_id=%s: %s", literature_id, e, exc_info=True)
        async with AsyncSessionLocal() as db:
            await LiteratureMapper.update_status(db, literature_id, "failed", str(e))
            await db.commit()
    finally:
        # 清理临时文件
        try:
            os.remove(file_path)
        except Exception:
            pass


class LiteratureService:

    @staticmethod
    async def upload(
        db,
        template_id: UUID,
        file_content: bytes,
        filename: str,
    ) -> Literature:
        """
        上传 PDF 文献：
        1. 校验格式和大小
        2. 上传 OSS
        3. 创建 literature 记录（pending）
        4. 启动后台处理任务
        5. 立即返回 literature 对象
        """
        import tempfile, os

        # 校验
        if not filename.lower().endswith(".pdf"):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="仅支持 PDF 格式")
        if len(file_content) > MAX_PDF_SIZE:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="文件大小不能超过 30MB")

        # 上传文件
        object_key = f"literature/{uuid4().hex}.pdf"
        file_url = await upload_file(file_content, object_key, "application/pdf")

        # 创建记录
        literature = Literature(
            template_id=template_id,
            source_file=file_url,
            upload_status="pending",
        )
        result = await LiteratureMapper.create(db, literature)
        await db.commit()

        # 写临时文件供 PyPDFLoader 使用（PyPDFLoader 需要文件路径）
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp.write(file_content)
        tmp.close()

        # 启动后台任务
        task = asyncio.create_task(
            _process_literature_async(result.literature_id, tmp.name),
            name=f"literature_process_{result.literature_id}",
        )
        task.add_done_callback(log_task_exception)

        return result

    @staticmethod
    async def list_by_template(db, template_id: UUID) -> list[Literature]:
        return await LiteratureMapper.list_by_template_id(db, template_id)

    @staticmethod
    async def get_by_id(db, literature_id: UUID) -> Literature | None:
        return await LiteratureMapper.get_by_id(db, literature_id)

    @staticmethod
    async def delete(db, literature_id: UUID) -> None:
        """删除文献（chunks 级联删除，OSS 文件异步清理）"""
        from fastapi import HTTPException
        lit = await LiteratureMapper.get_by_id(db, literature_id)
        if not lit:
            raise HTTPException(status_code=404, detail="文献不存在")

        # 异步清理文件
        if lit.source_file:
            async def _delete_storage():
                try:
                    object_key = "literature/" + lit.source_file.split("/literature/")[-1]
                    await delete_file(object_key)
                except Exception as e:
                    logger.warning("文件删除失败: %s", e)
            task = asyncio.create_task(_delete_storage(), name=f"storage_delete_{literature_id}")
            task.add_done_callback(log_task_exception)

        await LiteratureMapper.delete(db, literature_id)
        await db.commit()

    @staticmethod
    async def retry(db, literature_id: UUID) -> Literature:
        """重新处理失败的文献"""
        import tempfile, asyncio
        from fastapi import HTTPException
        lit = await LiteratureMapper.get_by_id(db, literature_id)
        if not lit:
            raise HTTPException(status_code=404, detail="文献不存在")
        if lit.upload_status not in ("failed", "pending"):
            raise HTTPException(status_code=400, detail="只有失败或待处理的文献才能重试")
        if not lit.source_file:
            raise HTTPException(status_code=400, detail="文献文件不存在，无法重试")

        # 从存储读取文件
        object_key = "literature/" + lit.source_file.split("/literature/")[-1]
        file_content = await read_file(object_key)

        # 清空旧 chunks
        async with AsyncSessionLocal() as db2:
            await LiteratureChunkMapper.delete_by_literature_id(db2, literature_id)
            await LiteratureMapper.update_status(db2, literature_id, "pending", None)
            await db2.commit()

        # 写临时文件
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp.write(file_content)
        tmp.close()

        task = asyncio.create_task(
            _process_literature_async(literature_id, tmp.name),
            name=f"literature_retry_{literature_id}",
        )
        task.add_done_callback(log_task_exception)

        return await LiteratureMapper.get_by_id(db, literature_id)
