"""
链测试

测试 RAG、Generation、Evaluation、Refinement 链
"""

import pytest
from uuid import uuid4

from services.langchain.chains.rag_chain import create_rag_chain, LiteratureRAGChain
from services.langchain.chains.generation_chain import (
    create_paragraph_generation_chain,
    create_summary_generation_chain,
)
from services.langchain.chains.evaluation_chain import create_evaluation_chain, EvaluationResult
from services.langchain.chains.refinement_chain import create_refinement_chain
from services.langchain.core.session_adapter import DocumentContext
from db.models import Document


class TestRAGChain:
    """测试 RAG 检索链"""
    
    def test_create_rag_chain(self):
        """测试创建 RAG 链"""
        # 跳过，需要数据库
        pytest.skip("需要数据库")
    
    @pytest.mark.asyncio
    async def test_retrieve_for_paragraph(self):
        """测试段落级检索"""
        # 跳过，需要数据库和文献数据
        pytest.skip("需要数据库和文献数据")
    
    @pytest.mark.asyncio
    async def test_retrieve_for_template(self):
        """测试模板级检索"""
        # 跳过，需要数据库和文献数据
        pytest.skip("需要数据库和文献数据")
    
    def test_format_context(self):
        """测试格式化上下文"""
        # 单元测试
        pass


class TestParagraphGenerationChain:
    """测试段落生成链"""
    
    def test_create_chain(self):
        """测试创建链"""
        chain = create_paragraph_generation_chain()
        assert chain is not None
    
    @pytest.mark.asyncio
    async def test_generate(self):
        """测试生成段落"""
        # 跳过，需要真实 API Key
        pytest.skip("需要真实 API Key")
        
        chain = create_paragraph_generation_chain()
        
        # 创建测试上下文
        doc = Document(
            document_id=uuid4(),
            title="测试文档",
            purpose="测试用途",
        )
        doc_context = DocumentContext(
            document_id=doc.document_id,
            document=doc,
        )
        
        result, citations = await chain.generate(
            doc_context=doc_context,
            chapter_title="研究背景",
            literature_context="",
        )
        
        assert isinstance(result, str)
        assert len(result) > 0
        assert isinstance(citations, list)
    
    def test_extract_citations(self):
        """测试提取引用"""
        chain = create_paragraph_generation_chain()
        
        text = "这是一段测试文本[1]，包含多个引用[2][3]。"
        citations = chain._extract_citations(text)
        
        assert citations == [1, 2, 3]


class TestSummaryGenerationChain:
    """测试摘要生成链"""
    
    def test_create_chain(self):
        """测试创建链"""
        chain = create_summary_generation_chain()
        assert chain is not None
    
    @pytest.mark.asyncio
    async def test_generate(self):
        """测试生成摘要"""
        # 跳过，需要真实 API Key
        pytest.skip("需要真实 API Key")


class TestEvaluationChain:
    """测试质量评估链"""
    
    def test_create_chain(self):
        """测试创建链"""
        chain = create_evaluation_chain()
        assert chain is not None
    
    @pytest.mark.asyncio
    async def test_evaluate(self):
        """测试评估"""
        # 跳过，需要真实 API Key
        pytest.skip("需要真实 API Key")
    
    def test_parse_evaluation(self):
        """测试解析评估结果"""
        chain = create_evaluation_chain()
        
        result_text = """
【评估结论】
内容完整，表达清晰。

【评分】
完整性：0.85
准确性：0.90
风格一致性：0.88
引用规范性：0.80
总体评分：0.86

【发现的问题】
1. 部分术语需要更专业
2. 引用格式不统一

【改进建议】
1. 使用更专业的术语
2. 统一引用格式
3. 增加数据支撑
"""
        
        evaluation = chain._parse_evaluation(result_text)
        
        assert isinstance(evaluation, EvaluationResult)
        assert evaluation.score == 0.86
        assert evaluation.completeness == 0.85
        assert len(evaluation.issues) == 2
        assert len(evaluation.suggestions) == 3


class TestRefinementChain:
    """测试内容优化链"""
    
    def test_create_chain(self):
        """测试创建链"""
        chain = create_refinement_chain()
        assert chain is not None
    
    @pytest.mark.asyncio
    async def test_refine(self):
        """测试优化"""
        # 跳过，需要真实 API Key
        pytest.skip("需要真实 API Key")
    
    @pytest.mark.asyncio
    async def test_iterative_refine(self):
        """测试迭代优化"""
        # 跳过，需要真实 API Key
        pytest.skip("需要真实 API Key")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
