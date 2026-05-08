"""
服务路由器

根据 Feature Flag 动态切换 v1/v2 服务，提供降级方案
"""

import logging
from typing import Any, Callable, Optional
from functools import wraps
import time

from core.langchain_config import is_langchain_enabled

logger = logging.getLogger(__name__)


class ServiceRouter:
    """
    服务路由器
    
    根据 Feature Flag 动态选择 v1 或 v2 服务，
    支持降级方案（v2 失败时自动回退到 v1）
    """
    
    @staticmethod
    def route_service(
        feature: str,
        v1_service: Any,
        v2_service: Any,
        fallback_enabled: bool = True,
    ):
        """
        路由服务调用
        
        Args:
            feature: 功能名称（rag, chat, paragraph, workflow）
            v1_service: v1 服务实例
            v2_service: v2 服务实例
            fallback_enabled: 是否启用降级（v2 失败时回退到 v1）
        
        Returns:
            选中的服务实例
        """
        if is_langchain_enabled(feature):
            logger.info(f"[服务路由] 使用 v2 服务: feature={feature}")
            
            if fallback_enabled:
                # 包装 v2 服务，添加降级逻辑
                return ServiceRouter._wrap_with_fallback(
                    v2_service,
                    v1_service,
                    feature,
                )
            else:
                return v2_service
        else:
            logger.info(f"[服务路由] 使用 v1 服务: feature={feature}")
            return v1_service
    
    @staticmethod
    def _wrap_with_fallback(v2_service: Any, v1_service: Any, feature: str):
        """
        包装 v2 服务，添加降级逻辑
        
        当 v2 服务调用失败时，自动回退到 v1 服务
        """
        class FallbackWrapper:
            def __getattr__(self, name):
                v2_method = getattr(v2_service, name, None)
                v1_method = getattr(v1_service, name, None)
                
                if v2_method is None:
                    # v2 服务没有该方法，直接使用 v1
                    return v1_method
                
                if v1_method is None:
                    # v1 服务没有该方法，只能使用 v2
                    return v2_method
                
                # 包装方法，添加降级逻辑
                if callable(v2_method):
                    @wraps(v2_method)
                    async def wrapped(*args, **kwargs):
                        start_time = time.time()
                        
                        try:
                            # 尝试调用 v2
                            result = await v2_method(*args, **kwargs)
                            
                            duration = time.time() - start_time
                            logger.info(
                                f"[服务路由] v2 调用成功: feature={feature} "
                                f"method={name} duration={duration:.2f}s"
                            )
                            
                            return result
                        
                        except Exception as e:
                            duration = time.time() - start_time
                            logger.error(
                                f"[服务路由] v2 调用失败，降级到 v1: feature={feature} "
                                f"method={name} error={e} duration={duration:.2f}s"
                            )
                            
                            # 降级到 v1
                            try:
                                result = await v1_method(*args, **kwargs)
                                logger.info(f"[服务路由] v1 降级调用成功: feature={feature} method={name}")
                                return result
                            
                            except Exception as fallback_error:
                                logger.error(
                                    f"[服务路由] v1 降级调用也失败: feature={feature} "
                                    f"method={name} error={fallback_error}"
                                )
                                raise
                    
                    return wrapped
                else:
                    return v2_method
        
        return FallbackWrapper()


# 便捷函数
def get_ai_service():
    """获取 AI 辅助编辑服务"""
    from services.ai_service import (
        ai_assist_paragraph as v1_assist,
        ai_evaluate_paragraph as v1_evaluate,
        assist_single_summary as v1_summary,
    )
    from services.langchain.services.ai_service_v2 import AIServiceV2
    
    # 创建 v1 服务包装器
    class V1AIService:
        @staticmethod
        async def ai_assist_paragraph(*args, **kwargs):
            async for chunk in v1_assist(*args, **kwargs):
                yield chunk
        
        @staticmethod
        def ai_evaluate_paragraph(*args, **kwargs):
            return v1_evaluate(*args, **kwargs)
        
        @staticmethod
        async def assist_single_summary(*args, **kwargs):
            return await v1_summary(*args, **kwargs)
    
    return ServiceRouter.route_service(
        feature="paragraph",
        v1_service=V1AIService(),
        v2_service=AIServiceV2(),
        fallback_enabled=True,
    )


def get_chat_service():
    """获取 AI 对话服务"""
    from services.ai_chat_service import AIChatService
    from services.langchain.services.ai_chat_service_v2 import AIChatServiceV2
    
    return ServiceRouter.route_service(
        feature="chat",
        v1_service=AIChatService(),
        v2_service=AIChatServiceV2(),
        fallback_enabled=True,
    )


def get_literature_rag_service():
    """获取文献 RAG 检索服务"""
    from services.literature_rag_service import LiteratureRagService
    from services.langchain.services.literature_rag_service_v2 import LiteratureRagServiceV2
    
    return ServiceRouter.route_service(
        feature="rag",
        v1_service=LiteratureRagService(),
        v2_service=LiteratureRagServiceV2(),
        fallback_enabled=True,
    )


def get_template_apply_service():
    """获取模板应用服务"""
    from services.template_apply_service import TemplateApplyService
    from services.langchain.services.template_apply_service_v2 import TemplateApplyServiceV2
    
    return ServiceRouter.route_service(
        feature="workflow",
        v1_service=TemplateApplyService(),
        v2_service=TemplateApplyServiceV2(),
        fallback_enabled=True,
    )
