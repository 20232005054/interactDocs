"""LangChain 链定义"""

from services.langchain.chains.generation_chain import (
    create_paragraph_generation_chain,
    create_summary_generation_chain,
    ParagraphGenerationChain,
    SummaryGenerationChain,
)
from services.langchain.chains.evaluation_chain import (
    create_evaluation_chain,
    QualityEvaluationChain,
)
from services.langchain.chains.refinement_chain import (
    create_refinement_chain,
    ContentRefinementChain,
)
from services.langchain.chains.rag_chain import (
    create_rag_chain,
    LiteratureRAGChain,
)
from services.langchain.chains.template_render_chain import (
    create_template_render_chain,
    TemplateRenderChain,
)
from services.langchain.chains.prompt_optimization_chain import (
    create_prompt_optimization_chain,
    PromptOptimizationChain,
)

__all__ = [
    "create_paragraph_generation_chain",
    "create_summary_generation_chain",
    "create_evaluation_chain",
    "create_refinement_chain",
    "create_rag_chain",
    "create_template_render_chain",
    "create_prompt_optimization_chain",
    "ParagraphGenerationChain",
    "SummaryGenerationChain",
    "QualityEvaluationChain",
    "ContentRefinementChain",
    "LiteratureRAGChain",
    "TemplateRenderChain",
    "PromptOptimizationChain",
]
