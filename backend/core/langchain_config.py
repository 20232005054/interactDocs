"""
LangChain 配置管理

统一管理 LangChain 相关配置，包括：
- LLM 配置
- 向量存储配置
- 记忆配置
- 可观测性配置
- Feature Flag
"""

import os
from typing import Optional
from pydantic import BaseModel


class LangChainConfig(BaseModel):
    """LangChain 配置"""
    
    # LLM 配置
    llm_model: str = "qwen-max"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2000
    llm_timeout: int = 30
    llm_max_retries: int = 3
    
    # 向量存储配置
    vector_store_type: str = "pgvector"
    embedding_model: str = "text-embedding-v3"
    embedding_dimension: int = 1536
    
    # 记忆配置
    memory_type: str = "summary_buffer"
    memory_max_token_limit: int = 2000
    memory_buffer_window: int = 5
    
    # 检索配置
    retrieval_top_k: int = 5
    retrieval_fetch_k: int = 20
    retrieval_search_type: str = "mmr"  # similarity, mmr, similarity_score_threshold
    
    # 可观测性配置
    langsmith_tracing: bool = False
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "interactive-docs"
    
    # Feature Flag
    enable_langchain: bool = False  # 总开关
    enable_langchain_rag: bool = False
    enable_langchain_chat: bool = False
    enable_langchain_paragraph: bool = False
    enable_langchain_workflow: bool = False
    
    # 性能配置
    enable_cache: bool = True
    cache_ttl: int = 3600  # 秒
    max_concurrent_requests: int = 10


# 全局配置实例
langchain_config = LangChainConfig(
    # 从环境变量读取
    llm_model=os.getenv("LANGCHAIN_LLM_MODEL", "qwen-max"),
    llm_temperature=float(os.getenv("LANGCHAIN_LLM_TEMPERATURE", "0.7")),
    llm_max_tokens=int(os.getenv("LANGCHAIN_LLM_MAX_TOKENS", "2000")),
    
    langsmith_tracing=os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true",
    langsmith_api_key=os.getenv("LANGCHAIN_API_KEY"),
    langsmith_project=os.getenv("LANGCHAIN_PROJECT", "interactive-docs"),
    
    enable_langchain=os.getenv("ENABLE_LANGCHAIN", "false").lower() == "true",
    enable_langchain_rag=os.getenv("ENABLE_LANGCHAIN_RAG", "false").lower() == "true",
    enable_langchain_chat=os.getenv("ENABLE_LANGCHAIN_CHAT", "false").lower() == "true",
    enable_langchain_paragraph=os.getenv("ENABLE_LANGCHAIN_PARAGRAPH", "false").lower() == "true",
    enable_langchain_workflow=os.getenv("ENABLE_LANGCHAIN_WORKFLOW", "false").lower() == "true",
)


def is_langchain_enabled(feature: Optional[str] = None) -> bool:
    """
    检查 LangChain 功能是否启用
    
    Args:
        feature: 功能名称（rag, chat, paragraph, workflow），None 表示检查总开关
    
    Returns:
        是否启用
    """
    if not langchain_config.enable_langchain:
        return False
    
    if feature is None:
        return True
    
    feature_flags = {
        "rag": langchain_config.enable_langchain_rag,
        "chat": langchain_config.enable_langchain_chat,
        "paragraph": langchain_config.enable_langchain_paragraph,
        "workflow": langchain_config.enable_langchain_workflow,
    }
    
    return feature_flags.get(feature, False)
