"""
文献摘要提取功能测试

运行方式：
python -m pytest backend/tests/test_literature_extract.py -v
"""

import pytest
from services.literature_extract_service import (
    extract_abstract_from_pdf,
    extract_doi_from_text,
    extract_abstract_smart,
)


def test_extract_doi_from_text():
    """测试 DOI 提取"""
    # 测试用例1：标准 DOI
    text1 = "This paper is published at DOI: 10.1234/example.2024.001"
    doi1 = extract_doi_from_text(text1)
    assert doi1 == "10.1234/example.2024.001"
    
    # 测试用例2：DOI 后跟标点符号
    text2 = "See DOI: 10.5678/test.2024.002."
    doi2 = extract_doi_from_text(text2)
    assert doi2 == "10.5678/test.2024.002"
    
    # 测试用例3：无 DOI
    text3 = "This text has no DOI"
    doi3 = extract_doi_from_text(text3)
    assert doi3 is None


def test_extract_abstract_from_pdf_mock():
    """测试 PDF 摘要提取（模拟）"""
    # 注意：实际测试需要真实的 PDF 文件
    # 这里只测试函数不会崩溃
    result = extract_abstract_from_pdf("nonexistent.pdf")
    assert result is None  # 文件不存在应返回 None


@pytest.mark.asyncio
async def test_extract_abstract_smart_fallback():
    """测试智能提取的兜底逻辑"""
    # 测试不存在的文件会抛出异常
    with pytest.raises(ValueError, match="无法从 PDF 提取任何可用内容"):
        await extract_abstract_smart("nonexistent.pdf")


if __name__ == "__main__":
    # 快速测试 DOI 提取
    test_extract_doi_from_text()
    print("✅ DOI 提取测试通过")
    
    test_extract_abstract_from_pdf_mock()
    print("✅ PDF 摘要提取测试通过")
    
    print("\n所有测试通过！")
