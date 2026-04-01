import asyncio
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_community.llms import Tongyi
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from services.langchain.config import LangChainConfig, langchain_config

logger = logging.getLogger(__name__)


class LLMCallbackHandler(BaseCallbackHandler):
    def __init__(self, template_id: Optional[str] = None, field_key: Optional[str] = None):
        self.template_id = template_id
        self.field_key = field_key
        self.start_time: Optional[float] = None

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        self.start_time = time.perf_counter()
        logger.info(
            "llm_start template_id=%s field_key=%s model=%s",
            self.template_id or "",
            self.field_key or "",
            kwargs.get("invocation_params", {}).get("model_name", "unknown"),
        )

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        duration_ms = int((time.perf_counter() - (self.start_time or 0)) * 1000)
        logger.info(
            "llm_end template_id=%s field_key=%s duration_ms=%s",
            self.template_id or "",
            self.field_key or "",
            duration_ms,
        )

    def on_llm_error(self, error: BaseException, **kwargs: Any) -> None:
        duration_ms = int((time.perf_counter() - (self.start_time or 0)) * 1000)
        logger.error(
            "llm_error template_id=%s field_key=%s duration_ms=%s error=%s",
            self.template_id or "",
            self.field_key or "",
            duration_ms,
            str(error),
        )


class LLMClient:
    _instance: Optional["LLMClient"] = None
    _lock: asyncio.Lock = asyncio.Lock()
    _semaphore: Optional[asyncio.Semaphore] = None

    def __new__(cls, config: Optional[LangChainConfig] = None) -> "LLMClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, config: Optional[LangChainConfig] = None):
        if self._initialized:
            return
        self._config = config or langchain_config
        self._llm: Optional[Tongyi] = None
        self._fallback_llm: Optional[Tongyi] = None
        self._initialized = True
        LLMClient._semaphore = asyncio.Semaphore(self._config.AI_MAX_CONCURRENCY)

    def _create_llm(self, model_name: Optional[str] = None) -> Tongyi:
        model = model_name or self._config.AI_MODEL
        return Tongyi(
            model_name=model,
            dashscope_api_key=self._config.DASHSCOPE_API_KEY,
            request_timeout=self._config.AI_TIMEOUT_SECONDS,
            max_retries=self._config.AI_MAX_RETRIES,
        )

    @property
    def llm(self) -> Tongyi:
        if self._llm is None:
            self._llm = self._create_llm()
        return self._llm

    @property
    def fallback_llm(self) -> Optional[Tongyi]:
        if not self._config.ENABLE_FALLBACK:
            return None
        if self._fallback_llm is None and self._config.FALLBACK_MODEL:
            self._fallback_llm = self._create_llm(self._config.FALLBACK_MODEL)
        return self._fallback_llm

    async def call_ai(
        self,
        prompt: str,
        template_id: Optional[str] = None,
        field_key: Optional[str] = None,
        use_fallback: bool = True,
    ) -> Dict[str, Any]:
        callback = LLMCallbackHandler(template_id=template_id, field_key=field_key)
        start_time = time.perf_counter()

        async with LLMClient._semaphore:
            try:
                result = await asyncio.to_thread(
                    self.llm.invoke,
                    prompt,
                    config={"callbacks": [callback]},
                )
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "content": result,
                    "duration_ms": duration_ms,
                    "error_code": None,
                    "model": self._config.AI_MODEL,
                }
            except Exception as e:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                logger.warning(
                    "llm_call_failed template_id=%s field_key=%s duration_ms=%s error=%s",
                    template_id or "",
                    field_key or "",
                    duration_ms,
                    str(e),
                )

                if use_fallback and self.fallback_llm:
                    logger.info(
                        "llm_fallback_start template_id=%s field_key=%s fallback_model=%s",
                        template_id or "",
                        field_key or "",
                        self._config.FALLBACK_MODEL,
                    )
                    try:
                        result = await asyncio.to_thread(
                            self.fallback_llm.invoke,
                            prompt,
                            config={"callbacks": [callback]},
                        )
                        duration_ms = int((time.perf_counter() - start_time) * 1000)
                        return {
                            "content": result,
                            "duration_ms": duration_ms,
                            "error_code": None,
                            "model": self._config.FALLBACK_MODEL,
                            "used_fallback": True,
                        }
                    except Exception as fallback_error:
                        logger.error(
                            "llm_fallback_failed template_id=%s field_key=%s error=%s",
                            template_id or "",
                            field_key or "",
                            str(fallback_error),
                        )
                        return {
                            "content": "",
                            "duration_ms": duration_ms,
                            "error_code": "AI_FALLBACK_ERROR",
                            "error_message": str(fallback_error),
                        }

                return {
                    "content": "",
                    "duration_ms": duration_ms,
                    "error_code": "AI_ERROR",
                    "error_message": str(e),
                }

    async def stream_ai(
        self,
        prompt: str,
        template_id: Optional[str] = None,
        field_key: Optional[str] = None,
        use_fallback: bool = True,
    ) -> AsyncGenerator[str, None]:
        callback = LLMCallbackHandler(template_id=template_id, field_key=field_key)
        start_time = time.perf_counter()

        async with LLMClient._semaphore:
            try:
                for chunk in self.llm.stream(prompt, config={"callbacks": [callback]}):
                    yield chunk
            except Exception as e:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                logger.warning(
                    "llm_stream_failed template_id=%s field_key=%s duration_ms=%s error=%s",
                    template_id or "",
                    field_key or "",
                    duration_ms,
                    str(e),
                )

                if use_fallback and self.fallback_llm:
                    logger.info(
                        "llm_stream_fallback_start template_id=%s field_key=%s fallback_model=%s",
                        template_id or "",
                        field_key or "",
                        self._config.FALLBACK_MODEL,
                    )
                    try:
                        for chunk in self.fallback_llm.stream(prompt, config={"callbacks": [callback]}):
                            yield chunk
                        return
                    except Exception as fallback_error:
                        logger.error(
                            "llm_stream_fallback_failed template_id=%s field_key=%s error=%s",
                            template_id or "",
                            field_key or "",
                            str(fallback_error),
                        )
                        yield f"Error: AI 调用失败 ({str(fallback_error)})"
                        return

                yield f"Error: AI 调用失败 ({str(e)})"


def get_llm_client(config: Optional[LangChainConfig] = None) -> LLMClient:
    return LLMClient(config)
