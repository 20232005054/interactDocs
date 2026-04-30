"""
文献摘要提取服务

职责：
1. 从 PDF 文件中快速提取摘要（Abstract）
2. 支持多种提取方式：元数据、正则匹配、CrossRef API
3. 提供兜底方案，确保总能返回可用内容
"""

import logging
import re
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# 摘要提取的最小长度（字符数）
MIN_ABSTRACT_LENGTH = 50

# 摘要提取的最大长度（字符数，防止误提取整页内容）
MAX_ABSTRACT_LENGTH = 2000

# 兜底方案：取首页前 N 字符
FALLBACK_FIRST_PAGE_LENGTH = 500


def extract_abstract_from_pdf(pdf_path: str) -> Optional[str]:
    """
    从 PDF 提取摘要，优先级：
    1. PDF 元数据中的 abstract 字段
    2. 首页正则匹配 "Abstract" 章节
    3. 兜底：首页前 500 字
    
    Args:
        pdf_path: PDF 文件路径
        
    Returns:
        摘要文本，失败返回 None
    """
    try:
        from pypdf import PdfReader
        
        reader = PdfReader(pdf_path)
        
        # 方法1：尝试从 PDF 元数据提取
        if reader.metadata:
            # 尝试常见的元数据字段
            for key in ["/Abstract", "/Subject", "/Description"]:
                if key in reader.metadata:
                    abstract = str(reader.metadata[key]).strip()
                    if MIN_ABSTRACT_LENGTH <= len(abstract) <= MAX_ABSTRACT_LENGTH:
                        logger.info("[摘要提取] 从 PDF 元数据提取成功 (字段=%s, 长度=%d)", key, len(abstract))
                        return abstract
        
        # 方法2：从首页正则匹配 "Abstract" 章节
        if len(reader.pages) > 0:
            first_page_text = reader.pages[0].extract_text()
            
            if first_page_text:
                # 正则模式：匹配 "Abstract" 到下一个章节标题之间的内容
                # 支持多种常见的章节标题格式
                patterns = [
                    # 模式1：Abstract 后跟内容，直到遇到下一个章节（Introduction, Keywords, 1., Background 等）
                    r'(?i)abstract\s*\n+(.*?)(?=\n\s*(?:introduction|keywords?|1\.|background|摘要|关键词)|\Z)',
                    # 模式2：Abstract 后跟内容，直到遇到两个连续换行（段落结束）
                    r'(?i)abstract\s*\n+(.*?)(?=\n\n|\Z)',
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, first_page_text, re.DOTALL | re.IGNORECASE)
                    if match:
                        abstract = match.group(1).strip()
                        # 清理多余的空白字符
                        abstract = re.sub(r'\s+', ' ', abstract)
                        
                        if MIN_ABSTRACT_LENGTH <= len(abstract) <= MAX_ABSTRACT_LENGTH:
                            logger.info("[摘要提取] 从首页正则匹配成功 (长度=%d)", len(abstract))
                            return abstract
                
                # 方法3：兜底方案 - 取首页前 N 字符
                fallback_text = first_page_text[:FALLBACK_FIRST_PAGE_LENGTH].strip()
                fallback_text = re.sub(r'\s+', ' ', fallback_text)
                
                if len(fallback_text) >= MIN_ABSTRACT_LENGTH:
                    logger.info("[摘要提取] 使用兜底方案（首页前 %d 字符）", len(fallback_text))
                    return fallback_text
        
        logger.warning("[摘要提取] 所有方法均失败，PDF 可能格式异常")
        return None
        
    except Exception as e:
        logger.error("[摘要提取] PDF 解析失败: %s", e, exc_info=True)
        return None


async def extract_abstract_from_crossref(doi: str) -> Optional[str]:
    """
    通过 CrossRef API 获取文献摘要
    
    Args:
        doi: 文献的 DOI
        
    Returns:
        摘要文本，失败返回 None
    """
    if not doi or not doi.strip():
        return None
    
    url = f"https://api.crossref.org/works/{doi}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "InteractiveDocs/1.0"})
            
            if resp.status_code != 200:
                logger.warning("[CrossRef] API 返回非 200 状态码: %d", resp.status_code)
                return None
            
            data = resp.json().get("message", {})
            abstract = data.get("abstract")
            
            if abstract and isinstance(abstract, str):
                abstract = abstract.strip()
                # CrossRef 的摘要可能包含 HTML 标签，简单清理
                abstract = re.sub(r'<[^>]+>', '', abstract)
                abstract = re.sub(r'\s+', ' ', abstract)
                
                if len(abstract) >= MIN_ABSTRACT_LENGTH:
                    logger.info("[CrossRef] 摘要提取成功 (DOI=%s, 长度=%d)", doi, len(abstract))
                    return abstract
            
            logger.info("[CrossRef] 未找到摘要字段 (DOI=%s)", doi)
            return None
            
    except Exception as e:
        logger.warning("[CrossRef] API 调用失败 (DOI=%s): %s", doi, e)
        return None


async def extract_abstract_smart(pdf_path: str, doi: Optional[str] = None) -> str:
    """
    智能提取摘要，综合多种方式：
    1. 优先从 PDF 提取（最快，最准确）
    2. 如果 PDF 提取失败且有 DOI，尝试 CrossRef
    3. 最终兜底：PDF 首页前 500 字
    
    Args:
        pdf_path: PDF 文件路径
        doi: 文献的 DOI（可选）
        
    Returns:
        摘要文本（保证非空）
        
    Raises:
        ValueError: 所有方法均失败时抛出
    """
    # 方法1：从 PDF 提取
    abstract = extract_abstract_from_pdf(pdf_path)
    if abstract:
        return abstract
    
    # 方法2：如果有 DOI，尝试 CrossRef
    if doi:
        abstract = await extract_abstract_from_crossref(doi)
        if abstract:
            return abstract
    
    # 方法3：最终兜底 - 强制从 PDF 取首页内容
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        if len(reader.pages) > 0:
            first_page = reader.pages[0].extract_text()
            if first_page:
                fallback = first_page[:FALLBACK_FIRST_PAGE_LENGTH].strip()
                fallback = re.sub(r'\s+', ' ', fallback)
                if fallback:
                    logger.warning("[摘要提取] 使用最终兜底方案（首页前 %d 字符）", len(fallback))
                    return fallback
    except Exception as e:
        logger.error("[摘要提取] 最终兜底方案也失败: %s", e)
    
    # 所有方法均失败
    raise ValueError("无法从 PDF 提取任何可用内容，文件可能损坏或格式不支持")


def extract_doi_from_pdf(pdf_path: str) -> Optional[str]:
    """
    从 PDF 文件中提取 DOI
    
    策略：
    1. 优先从 PDF 元数据提取
    2. 扫描前 3 页的完整文本（包括页眉、页脚）
    3. 使用正则匹配 DOI 模式
    
    Args:
        pdf_path: PDF 文件路径
        
    Returns:
        DOI 字符串，未找到返回 None
    """
    try:
        from pypdf import PdfReader
        
        reader = PdfReader(pdf_path)
        
        # 方法1：尝试从 PDF 元数据提取
        if reader.metadata:
            for key in ["/doi", "/DOI", "/Subject"]:
                if key in reader.metadata:
                    metadata_value = str(reader.metadata[key]).strip()
                    # 从元数据值中提取 DOI
                    doi = extract_doi_from_text(metadata_value)
                    if doi:
                        logger.info("[DOI 提取] 从 PDF 元数据提取成功 (字段=%s): %s", key, doi)
                        return doi
        
        # 方法2：扫描前 3 页的完整文本
        max_pages = min(3, len(reader.pages))
        for page_num in range(max_pages):
            page_text = reader.pages[page_num].extract_text()
            if page_text:
                doi = extract_doi_from_text(page_text)
                if doi:
                    logger.info("[DOI 提取] 从第 %d 页提取成功: %s", page_num + 1, doi)
                    return doi
        
        logger.info("[DOI 提取] 未找到 DOI（已扫描前 %d 页）", max_pages)
        return None
        
    except Exception as e:
        logger.error("[DOI 提取] PDF 解析失败: %s", e, exc_info=True)
        return None


def extract_doi_from_text(text: str) -> Optional[str]:
    """
    从文本中提取 DOI
    
    Args:
        text: 文本内容
        
    Returns:
        DOI 字符串，未找到返回 None
    """
    if not text:
        return None
    
    # DOI 正则模式：10.xxxx/xxxxx
    # 支持多种常见格式：
    # - 纯 DOI: 10.1234/abcd
    # - 带前缀: doi:10.1234/abcd, DOI:10.1234/abcd
    # - 带 URL: https://doi.org/10.1234/abcd
    patterns = [
        r'(?:doi\.org/|doi:|DOI:)?\s*(10\.\d{4,9}/[^\s"\'<>]+)',
        r'\b(10\.\d{4,9}/[^\s"\'<>]+)\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            doi = match.group(1) if match.lastindex else match.group(0)
            # 清理末尾可能的标点符号
            doi = doi.rstrip(".,;)")
            
            # 清理 eLife 特有的版本号后缀（.001, .002, .003 等）
            # 例如：10.7554/eLife.24179.001 → 10.7554/eLife.24179
            # 这些版本号后缀在 CrossRef 中不被识别
            doi = re.sub(r'\.\d{3}$', '', doi)
            
            return doi
    
    return None


async def fetch_crossref_metadata(doi: str) -> dict:
    """
    通过 CrossRef API 获取文献完整元数据
    
    Args:
        doi: 文献的 DOI
        
    Returns:
        元数据字典，包含 title, authors, journal, publish_date 等字段
    """
    url = f"https://api.crossref.org/works/{doi}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "InteractiveDocs/1.0"})
            
            if resp.status_code != 200:
                logger.warning("[CrossRef] 元数据获取失败，状态码: %d", resp.status_code)
                return {}
            
            data = resp.json().get("message", {})
            
            # 提取作者
            authors_list = data.get("author", [])
            authors = ", ".join(
                f"{a.get('family', '')} {a.get('given', '')}".strip()
                for a in authors_list[:5]  # 最多取前 5 位作者
            )
            
            # 提取期刊名称
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
                    y = parts[0] if len(parts) > 0 else 2000
                    m = parts[1] if len(parts) > 1 else 1
                    d = parts[2] if len(parts) > 2 else 1
                    publish_date = date(y, m, d)
                except Exception as e:
                    logger.warning("[CrossRef] 日期解析失败: %s", e)
            
            # 提取标题
            title = ""
            titles = data.get("title", [])
            if titles:
                title = titles[0]
            
            metadata = {
                "title": title or None,
                "authors": authors or None,
                "journal": journal or None,
                "publish_date": publish_date,
            }
            
            logger.info("[CrossRef] 元数据获取成功 (DOI=%s)", doi)
            return metadata
            
    except Exception as e:
        logger.warning("[CrossRef] 元数据获取失败 (DOI=%s): %s", doi, e)
        return {}
