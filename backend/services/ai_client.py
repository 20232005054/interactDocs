"""
AI 客户端（已迁移到 LangChain）

保留功能：
- get_embedding: 获取文本 embedding（LangChain 使用）
- cosine_similarity: 计算余弦相似度（变更检测使用）

已删除功能：
- call_qwen_once: 已迁移到 LangChain chains
- _call_generation_with_retry: 已迁移到 LangChain LLM

所有 AI 调用请使用 LangChain 框架：
- services/langchain/chains/template_render_chain.py
- services/langchain/chains/generation_chain.py
- services/langchain/chains/prompt_optimization_chain.py
"""

import asyncio
import logging
from http import HTTPStatus
from typing import Optional

import dashscope

logger = logging.getLogger(__name__)


class AIClientError(Exception):
    """AI 客户端错误"""
    def __init__(self, message: str, error_code: str, duration_ms: Optional[int] = None):
        super().__init__(message)
        self.error_code = error_code
        self.duration_ms = duration_ms


async def get_embedding(text: str) -> list[float]:
    """获取文本的 embedding 向量，用于语义相似度计算"""
    try:
        response = await asyncio.to_thread(
            dashscope.TextEmbedding.call,
            model="text-embedding-v3",
            input=text,
        )
        if response.status_code == HTTPStatus.OK:
            return response.output["embeddings"][0]["embedding"]
        raise AIClientError(
            f"Embedding 调用失败: {getattr(response, 'message', 'unknown')}",
            error_code="EMBEDDING_ERROR"
        )
    except AIClientError:
        raise
    except Exception as exc:
        raise AIClientError(str(exc), error_code="EMBEDDING_ERROR")


async def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """计算两个向量的余弦相似度"""
    import math
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
