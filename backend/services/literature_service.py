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
from db.mappers.template_literature_mapper import TemplateLiteratureMapper
from db.models import Literature, LiteratureChunk
from db.session import AsyncSessionLocal
from services.ai_client import get_embedding
from services.oss_service import upload_file, delete_file, read_file

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
            authors_list = data.get("author", [])
            authors = ", ".join(
                f"{a.get('family', '')} {a.get('given', '')}".strip()
                for a in authors_list[:5]
            )
            journal = ""
            container = data.get("container-title", [])
            if container:
                journal = container[0]
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
        logger.info("[文献处理] 解析完成，共 %d 页，全文 %d 字符", len(pages), len(full_text))

        # 2. 分块
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", "。", ".", " ", ""],
        )
        docs = splitter.create_documents([full_text])
        if not docs:
            raise ValueError("文本分块结果为空")
        logger.info("[文献处理] 分块完成，共 %d 块", len(docs))

        # 3. 向量化 + 写入 chunks
        chunks: list[LiteratureChunk] = []
        progress_step = max(1, len(docs) // 5)  # 每 20% 打一次进度
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
                embedding=embedding,
                chunk_index=idx,
            ))
            if idx % progress_step == 0 or idx == len(docs) - 1:
                logger.info("[文献处理] 向量化进度 %d/%d (%.0f%%)", idx + 1, len(docs), (idx + 1) / len(docs) * 100)

        async with AsyncSessionLocal() as db:
            for chunk in chunks:
                from sqlalchemy import text
                embedding_str = chunk.embedding if isinstance(chunk.embedding, str) else str(chunk.embedding)
                sql = text(f"""
                    INSERT INTO literature_chunks
                        (chunk_id, literature_id, section_type, content, embedding, chunk_index)
                    VALUES
                        (:chunk_id, :literature_id, :section_type, :content, '{embedding_str}'::vector, :chunk_index)
                """)
                await db.execute(sql, {
                    "chunk_id": str(uuid4()),
                    "literature_id": str(literature_id),
                    "section_type": chunk.section_type,
                    "content": chunk.content,
                    "chunk_index": chunk.chunk_index,
                })
            await db.commit()
        logger.info("[文献处理] 写入 %d 个分块 literature_id=%s", len(chunks), literature_id)

        # 4. 提取 DOI，补全 metadata
        # 如果上传时已手动填写 doi，跳过自动提取，只补全其他 metadata 字段
        async with AsyncSessionLocal() as db_check:
            existing_lit = await LiteratureMapper.get_by_id(db_check, literature_id)
            existing_doi = existing_lit.doi if existing_lit else None

        metadata_update: dict = {}
        if existing_doi:
            # 已有 doi，直接用已有的调 CrossRef 补全其他字段
            logger.info("[文献处理] 已有 DOI=%s，跳过提取，直接补全 metadata", existing_doi)
            crossref_data = await _fetch_crossref_metadata(existing_doi)
            # 只补全空字段，不覆盖用户已填写的内容
            for k, v in crossref_data.items():
                if v is not None and not getattr(existing_lit, k, None):
                    metadata_update[k] = v
        else:
            # 没有 doi，尝试从 PDF 全文提取
            doi = _extract_doi(full_text)
            if doi:
                logger.info("[文献处理] 提取到 DOI=%s，调用 CrossRef", doi)
                crossref_data = await _fetch_crossref_metadata(doi)
                metadata_update = {k: v for k, v in crossref_data.items() if v is not None}
                metadata_update["doi"] = doi
            else:
                logger.info("[文献处理] 未提取到 DOI，跳过 CrossRef 补全")

        async with AsyncSessionLocal() as db:
            if metadata_update:
                await LiteratureMapper.update_metadata(db, literature_id, metadata_update)
                logger.info("[文献处理] metadata 补全字段: %s", list(metadata_update.keys()))
            await LiteratureMapper.update_status(db, literature_id, "ready")
            await db.commit()

        logger.info("[文献处理] ✅ 完成 literature_id=%s", literature_id)

    except Exception as e:
        logger.error("[文献处理] ❌ 失败 literature_id=%s: %s", literature_id, e, exc_info=True)
        async with AsyncSessionLocal() as db:
            await LiteratureMapper.update_status(db, literature_id, "failed", str(e))
            await db.commit()
    finally:
        try:
            os.remove(file_path)
        except Exception:
            pass


class LiteratureService:

    @staticmethod
    async def upload(
        db,
        file_content: bytes,
        filename: str,
        scope: str,
        user_id: UUID,
        literature_key: str | None = None,
    ) -> Literature:
        """
        上传 PDF 文献到知识库：
        1. 校验格式和大小
        2. 上传 OSS
        3. 创建 literature 记录（pending），scope/user_id 由调用方传入
        4. literature_key：传入则使用（跨系统迁移），不传则自动生成 lit_xxxxxxxx
        5. 启动后台处理任务
        6. 立即返回 literature 对象
        """
        import tempfile

        if not filename.lower().endswith(".pdf"):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="仅支持 PDF 格式")
        if len(file_content) > MAX_PDF_SIZE:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="文件大小不能超过 30MB")

        # 生成或使用传入的 literature_key
        if not literature_key:
            literature_key = "lit_" + uuid4().hex[:8]

        object_key = f"literature/{uuid4().hex}.pdf"
        file_url = await upload_file(file_content, object_key, "application/pdf")

        literature = Literature(
            literature_key=literature_key,
            source_file=file_url,
            upload_status="pending",
            scope=scope,
            user_id=user_id,
        )
        result = await LiteratureMapper.create(db, literature)
        await db.commit()

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp.write(file_content)
            tmp.close()
            task = asyncio.create_task(
                _process_literature_async(result.literature_id, tmp.name),
                name=f"literature_process_{result.literature_id}",
            )
            task.add_done_callback(log_task_exception)
        except Exception:
            import os
            try:
                os.remove(tmp.name)
            except Exception:
                pass
            raise

        return result

    @staticmethod
    async def bind(db, template_id: UUID, literature_id: UUID) -> None:
        """绑定文献到模板"""
        await TemplateLiteratureMapper.bind(db, template_id, literature_id)
        await db.commit()

    @staticmethod
    async def unbind(db, template_id: UUID, literature_id: UUID) -> None:
        """解绑文献与模板"""
        await TemplateLiteratureMapper.unbind(db, template_id, literature_id)
        await db.commit()

    @staticmethod
    async def list_by_template(db, template_id: UUID) -> list[Literature]:
        """获取模板绑定的所有文献"""
        return await LiteratureMapper.list_by_template_id(db, template_id)

    @staticmethod
    async def list_by_user(db, user_id: UUID) -> list[Literature]:
        """获取用户上传的所有私有文献"""
        return await LiteratureMapper.list_by_user_id(db, user_id)

    @staticmethod
    async def list_public(db) -> list[Literature]:
        """获取所有公共文献"""
        return await LiteratureMapper.list_public(db)

    @staticmethod
    async def list_all(db) -> list[Literature]:
        """获取所有文献（admin 用）"""
        return await LiteratureMapper.list_all(db)

    @staticmethod
    async def list_all_private(db) -> list[Literature]:
        """获取所有私有文献（admin 用）"""
        return await LiteratureMapper.list_all_private(db)

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
        import tempfile
        from fastapi import HTTPException
        lit = await LiteratureMapper.get_by_id(db, literature_id)
        if not lit:
            raise HTTPException(status_code=404, detail="文献不存在")
        if lit.upload_status not in ("failed", "pending"):
            raise HTTPException(status_code=400, detail="只有失败或待处理的文献才能重试")
        if not lit.source_file:
            raise HTTPException(status_code=400, detail="文献文件不存在，无法重试")

        source = lit.source_file
        if "/literature/" in source:
            object_key = "literature/" + source.split("/literature/")[-1].lstrip("/")
        else:
            raise HTTPException(status_code=400, detail="无法解析文献文件路径，无法重试")
        file_content = await read_file(object_key)

        async with AsyncSessionLocal() as db2:
            await LiteratureChunkMapper.delete_by_literature_id(db2, literature_id)
            await LiteratureMapper.update_status(db2, literature_id, "pending", None)
            await db2.commit()

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp.write(file_content)
            tmp.close()
            task = asyncio.create_task(
                _process_literature_async(literature_id, tmp.name),
                name=f"literature_retry_{literature_id}",
            )
            task.add_done_callback(log_task_exception)
        except Exception:
            import os
            try:
                os.remove(tmp.name)
            except Exception:
                pass
            raise

        async with AsyncSessionLocal() as db3:
            return await LiteratureMapper.get_by_id(db3, literature_id)

    @staticmethod
    async def list_orphans(db) -> list[Literature]:
        """获取孤儿文献列表（admin 后台清理用）"""
        return await LiteratureMapper.list_orphans(db)

    @staticmethod
    async def update(db, literature_id: UUID, data: dict) -> Literature:
        """手动更新文献元数据（title/authors/journal/doi/impact_factor）"""
        from fastapi import HTTPException
        lit = await LiteratureMapper.get_by_id(db, literature_id)
        if not lit:
            raise HTTPException(status_code=404, detail="文献不存在")
        await LiteratureMapper.update_metadata(db, literature_id, data)
        await db.commit()
        async with AsyncSessionLocal() as db2:
            return await LiteratureMapper.get_by_id(db2, literature_id)
