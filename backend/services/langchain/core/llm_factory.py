"""
LLM 工厂

统一管理 LLM 实例创建，支持：
- 通义千问适配
- 流式/非流式模式
- 连接池管理
- 自动重试和降级
"""

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, List, Optional
from http import HTTPStatus

import dashscope
from langchain_core.language_models.llms import LLM
from langchain_core.callbacks.manager import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun
from langchain_core.outputs import GenerationChunk

from core.config import (
    AI_MODEL, AI_TIMEOUT_SECONDS, AI_MAX_RETRIES, AI_RETRY_BACKOFF_SECONDS, AI_MAX_CONCURRENCY,
    LLM_TEMPERATURE, LLM_MAX_TOKENS
)
from services.ai_client import AIClientError, _classify_exception, _ERROR_HINTS

logger = logging.getLogger(__name__)

# 全局并发控制
_LLM_SEMAPHORE = asyncio.Semaphore(AI_MAX_CONCURRENCY)

class QwenLLM(LLM):
    """
    通义千问 LLM 适配器
    
    适配 LangChain LLM 接口，复用现有的 dashscope 调用逻辑
    """
    
    model_name: str = AI_MODEL
    temperature: float = LLM_TEMPERATURE
    max_tokens: int = LLM_MAX_TOKENS
    timeout: int = AI_TIMEOUT_SECONDS
    max_retries: int = AI_MAX_RETRIES
    
    @property
    def _llm_type(self) -> str:
        """返回 LLM 类型"""
        return "qwen"
    
    @property
    def _identifying_params(self) -> Dict[str, Any]:
        """返回识别参数"""
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
    
    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """
        同步调用（不推荐使用，LangChain 会自动转换为异步）
        """
        raise NotImplementedError("请使用异步方法 _acall")
    
    async def _acall(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """
        异步调用（非流式）
        
        Args:
            prompt: 用户输入
            stop: 停止词（暂不支持）
            run_manager: 回调管理器
            **kwargs: 额外参数（system_prompt, history）
        
        Returns:
            生成的文本
        """
        system_prompt = kwargs.get("system_prompt", "")
        history = kwargs.get("history", [])
        
        # 构建消息列表
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        
        # 调用 dashscope
        response = await self._call_with_retry(messages, stream=False)
        
        if response.status_code != HTTPStatus.OK:
            error_msg = f"AI调用失败: {getattr(response, 'message', 'unknown error')}"
            logger.error(error_msg)
            raise AIClientError(error_msg, error_code="AI_CALL_FAILED")
        
        content = str(response.output.choices[0]["message"]["content"]).strip()
        
        # 触发回调
        if run_manager:
            await run_manager.on_llm_end({"generations": [[{"text": content}]]})
        
        return content
    
    async def _astream(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[GenerationChunk]:
        """
        异步流式调用
        
        Args:
            prompt: 用户输入
            stop: 停止词（暂不支持）
            run_manager: 回调管理器
            **kwargs: 额外参数（system_prompt, history）
        
        Yields:
            生成的文本块
        """
        system_prompt = kwargs.get("system_prompt", "")
        history = kwargs.get("history", [])
        
        # 构建消息列表
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        
        # 调用 dashscope 流式接口
        responses = await self._call_with_retry(messages, stream=True)
        
        # 使用线程池 + Queue 处理同步 generator
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()
        
        def _producer():
            """在线程里同步迭代 generator"""
            try:
                for response in responses:
                    if response.status_code == HTTPStatus.OK:
                        chunk = response.output.choices[0]["message"]["content"]
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
                    else:
                        error_msg = f"AI调用失败: {getattr(response, 'message', '')}"
                        loop.call_soon_threadsafe(queue.put_nowait, Exception(error_msg))
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)
        
        loop.run_in_executor(None, _producer)
        
        # 消费 queue
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                raise item
            
            chunk = GenerationChunk(text=item)
            yield chunk
            
            # 触发回调
            if run_manager:
                await run_manager.on_llm_new_token(item, chunk=chunk)
    
    async def _call_with_retry(
        self,
        messages: List[Dict[str, str]],
        stream: bool,
    ) -> Any:
        """
        带重试的调用
        
        Args:
            messages: 消息列表
            stream: 是否流式
        
        Returns:
            响应对象
        """
        last_error: Optional[Exception] = None
        attempts = self.max_retries + 1
        
        for attempt in range(1, attempts + 1):
            try:
                async with _LLM_SEMAPHORE:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            dashscope.Generation.call,
                            model=self.model_name,
                            messages=messages,
                            result_format="message",
                            stream=stream,
                            incremental_output=stream,
                            temperature=self.temperature,
                            max_tokens=self.max_tokens,
                        ),
                        timeout=self.timeout,
                    )
                return response
            
            except asyncio.TimeoutError:
                last_error = AIClientError(
                    f"AI请求超时，超过{self.timeout}秒",
                    error_code="AI_TIMEOUT",
                )
                logger.warning(f"AI调用超时，重试 {attempt}/{self.max_retries}")
                if attempt < attempts:
                    await asyncio.sleep(AI_RETRY_BACKOFF_SECONDS * attempt)
                continue
            
            except Exception as exc:
                error_code = _classify_exception(exc)
                last_error = AIClientError(str(exc), error_code=error_code)
                logger.warning(f"AI调用失败: {exc}，重试 {attempt}/{self.max_retries}")
                if attempt < attempts:
                    await asyncio.sleep(AI_RETRY_BACKOFF_SECONDS * attempt)
                continue
        
        # 所有重试耗尽
        if isinstance(last_error, AIClientError):
            hint = _ERROR_HINTS.get(last_error.error_code, _ERROR_HINTS["AI_REQUEST_ERROR"])
            logger.error(f"AI调用失败: {hint}")
        raise last_error


# 全局 LLM 实例缓存
_llm_cache: Dict[str, QwenLLM] = {}


def get_qwen_llm(
    model_name: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> QwenLLM:
    """
    获取 QwenLLM 实例（带缓存）
    
    Args:
        model_name: 模型名称
        temperature: 温度
        max_tokens: 最大 token 数
    
    Returns:
        QwenLLM 实例
    """
    cache_key = f"{model_name or AI_MODEL}_{temperature or LLM_TEMPERATURE}_{max_tokens or LLM_MAX_TOKENS}"
    
    if cache_key not in _llm_cache:
        _llm_cache[cache_key] = QwenLLM(
            model_name=model_name or AI_MODEL,
            temperature=temperature or LLM_TEMPERATURE,
            max_tokens=max_tokens or LLM_MAX_TOKENS,
        )
    
    return _llm_cache[cache_key]


def clear_llm_cache():
    """清空 LLM 缓存"""
    _llm_cache.clear()
