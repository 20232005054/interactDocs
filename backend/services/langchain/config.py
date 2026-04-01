import os
from dataclasses import dataclass
from typing import Optional


def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _get_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _get_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in ("true", "1", "yes", "on")


@dataclass
class LangChainConfig:
    AI_MODEL: str = os.getenv("AI_MODEL", "qwen-max")
    AI_TIMEOUT_SECONDS: float = _get_float_env("AI_TIMEOUT_SECONDS", 30.0)
    AI_MAX_RETRIES: int = max(_get_int_env("AI_MAX_RETRIES", 2), 0)
    AI_MAX_CONCURRENCY: int = max(_get_int_env("AI_MAX_CONCURRENCY", 5), 1)
    ENABLE_FALLBACK: bool = _get_bool_env("ENABLE_FALLBACK", False)
    FALLBACK_MODEL: Optional[str] = os.getenv("FALLBACK_MODEL", "qwen-plus")

    DASHSCOPE_API_KEY: Optional[str] = os.getenv("DASHSCOPE_API_KEY")

    @classmethod
    def from_env(cls) -> "LangChainConfig":
        return cls(
            AI_MODEL=os.getenv("AI_MODEL", "qwen-max"),
            AI_TIMEOUT_SECONDS=_get_float_env("AI_TIMEOUT_SECONDS", 30.0),
            AI_MAX_RETRIES=max(_get_int_env("AI_MAX_RETRIES", 2), 0),
            AI_MAX_CONCURRENCY=max(_get_int_env("AI_MAX_CONCURRENCY", 5), 1),
            ENABLE_FALLBACK=_get_bool_env("ENABLE_FALLBACK", False),
            FALLBACK_MODEL=os.getenv("FALLBACK_MODEL", "qwen-plus"),
            DASHSCOPE_API_KEY=os.getenv("DASHSCOPE_API_KEY"),
        )

    def validate(self) -> bool:
        if not self.DASHSCOPE_API_KEY:
            return False
        if self.AI_TIMEOUT_SECONDS <= 0:
            return False
        if self.AI_MAX_CONCURRENCY < 1:
            return False
        return True


langchain_config = LangChainConfig.from_env()
