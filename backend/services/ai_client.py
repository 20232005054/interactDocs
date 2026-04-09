import asyncio
import logging
import os
import time
from http import HTTPStatus
from typing import Any, AsyncGenerator, Dict, Optional, Tuple

import dashscope
from core.config import AI_MODEL, AI_TIMEOUT_SECONDS, AI_MAX_RETRIES, AI_RETRY_BACKOFF_SECONDS, AI_MAX_CONCURRENCY

logger = logging.getLogger(__name__)

_AI_SEMAPHORE = asyncio.Semaphore(AI_MAX_CONCURRENCY)


class AIClientError(Exception):
    def __init__(self, message: str, error_code: str, duration_ms: Optional[int] = None):
        super().__init__(message)
        self.error_code = error_code
        self.duration_ms = duration_ms


def _extract_error_code(response: Any) -> str:
    if hasattr(response, "code") and response.code:
        return str(response.code)
    if hasattr(response, "status_code") and response.status_code:
        return f"HTTP_{int(response.status_code)}"
    return "AI_UNKNOWN_ERROR"


async def _call_generation_with_retry(
    messages: list,
    stream: bool,
    incremental_output: bool,
    template_id: Optional[str] = None,
    field_key: Optional[str] = None,
) -> Tuple[Any, int]:
    last_error: Optional[Exception] = None
    attempts = AI_MAX_RETRIES + 1
    for attempt in range(1, attempts + 1):
        start = time.perf_counter()
        try:
            async with _AI_SEMAPHORE:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        dashscope.Generation.call,
                        model=AI_MODEL,
                        messages=messages,
                        result_format="message",
                        stream=stream,
                        incremental_output=incremental_output,
                    ),
                    timeout=AI_TIMEOUT_SECONDS,
                )
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.info(
                "ai_generation_request_ok template_id=%s field_key=%s duration_ms=%s retry_attempt=%s",
                template_id or "",
                field_key or "",
                duration_ms,
                attempt - 1,
            )
            return response, duration_ms
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - start) * 1000)
            last_error = AIClientError(
                f"AI请求超时，超过{AI_TIMEOUT_SECONDS}秒",
                error_code="AI_TIMEOUT",
                duration_ms=duration_ms,
            )
            logger.warning(
                "ai_generation_request_retry template_id=%s field_key=%s duration_ms=%s error_code=%s retry_attempt=%s",
                template_id or "",
                field_key or "",
                duration_ms,
                "AI_TIMEOUT",
                attempt - 1,
            )
            if attempt < attempts:
                await asyncio.sleep(AI_RETRY_BACKOFF_SECONDS * attempt)
            continue
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            last_error = AIClientError(
                str(exc),
                error_code="AI_REQUEST_ERROR",
                duration_ms=duration_ms,
            )
            logger.warning(
                "ai_generation_request_retry template_id=%s field_key=%s duration_ms=%s error_code=%s retry_attempt=%s",
                template_id or "",
                field_key or "",
                duration_ms,
                "AI_REQUEST_ERROR",
                attempt - 1,
            )
            if attempt < attempts:
                await asyncio.sleep(AI_RETRY_BACKOFF_SECONDS * attempt)
            continue
    if isinstance(last_error, AIClientError):
        raise last_error
    raise AIClientError("AI请求失败", error_code="AI_REQUEST_ERROR")


async def call_qwen_once(
    system_prompt: str,
    history: list,
    user_input: str,
    template_id: Optional[str] = None,
    field_key: Optional[str] = None,
) -> Dict[str, Any]:
    messages = [{"role": "system", "content": system_prompt}] + history + [
        {"role": "user", "content": user_input}
    ]
    response, duration_ms = await _call_generation_with_retry(
        messages=messages,
        stream=False,
        incremental_output=False,
        template_id=template_id,
        field_key=field_key,
    )
    if response.status_code != HTTPStatus.OK:
        error_code = _extract_error_code(response)
        logger.warning(
            "ai_generation_response_error template_id=%s field_key=%s duration_ms=%s error_code=%s",
            template_id or "",
            field_key or "",
            duration_ms,
            error_code,
        )
        raise AIClientError(
            f"AI调用失败: {getattr(response, 'message', 'unknown error')}",
            error_code=error_code,
            duration_ms=duration_ms,
        )
    content = str(response.output.choices[0]["message"]["content"]).strip()
    return {"content": content, "duration_ms": duration_ms, "error_code": None}


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


async def call_qwen_stream(
    system_prompt: str,
    history: list,
    user_input: str,
    template_id: Optional[str] = None,
    field_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    messages = [{"role": "system", "content": system_prompt}] + history + [
        {"role": "user", "content": user_input}
    ]
    responses, _ = await _call_generation_with_retry(
        messages=messages,
        stream=True,
        incremental_output=True,
        template_id=template_id,
        field_key=field_key,
    )
    for response in responses:
        if response.status_code == HTTPStatus.OK:
            yield response.output.choices[0]["message"]["content"]
            continue
        error_code = _extract_error_code(response)
        logger.warning(
            "ai_generation_stream_error template_id=%s field_key=%s error_code=%s",
            template_id or "",
            field_key or "",
            error_code,
        )
        yield f"Error: AI调用失败({error_code}): {response.message}"
