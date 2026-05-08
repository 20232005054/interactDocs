"""
性能监控接口

GET  /api/v1/monitoring/performance  获取性能统计
GET  /api/v1/monitoring/compare      对比 v1/v2 性能
GET  /api/v1/monitoring/failures     获取最近失败记录
POST /api/v1/monitoring/clear        清空监控数据
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from core.auth import get_current_user, require_admin
from core.response import success_response, ResponseModel
from core.performance_monitor import performance_monitor
from core.langchain_config import langchain_config

router = APIRouter(prefix="/api/v1/monitoring", tags=["性能监控"])


@router.get(
    "/performance",
    summary="获取性能统计",
    response_model=ResponseModel[dict],
)
async def get_performance_statistics(
    service_version: Optional[str] = None,
    feature: Optional[str] = None,
    method: Optional[str] = None,
    current_user=Depends(require_admin),
):
    """
    获取性能统计信息
    
    Args:
        service_version: 过滤服务版本（v1/v2）
        feature: 过滤功能（rag/chat/paragraph/workflow）
        method: 过滤方法名
    """
    stats = performance_monitor.get_statistics(
        service_version=service_version,
        feature=feature,
        method=method,
    )
    
    return success_response(data=stats)


@router.get(
    "/compare",
    summary="对比 v1/v2 性能",
    response_model=ResponseModel[dict],
)
async def compare_versions(
    feature: str,
    method: str,
    current_user=Depends(require_admin),
):
    """
    对比 v1 和 v2 的性能
    
    Args:
        feature: 功能名称（rag/chat/paragraph/workflow）
        method: 方法名
    """
    comparison = performance_monitor.compare_versions(feature, method)
    
    return success_response(data=comparison)


@router.get(
    "/failures",
    summary="获取最近失败记录",
    response_model=ResponseModel[list],
)
async def get_recent_failures(
    limit: int = 10,
    current_user=Depends(require_admin),
):
    """
    获取最近的失败记录
    
    Args:
        limit: 返回数量
    """
    failures = performance_monitor.get_recent_failures(limit=limit)
    
    return success_response(data=[
        {
            "service_version": f.service_version,
            "feature": f.feature,
            "method": f.method,
            "duration": f.duration,
            "error": f.error,
            "timestamp": f.timestamp.isoformat(),
        }
        for f in failures
    ])


@router.post(
    "/clear",
    summary="清空监控数据",
    response_model=ResponseModel[None],
)
async def clear_monitoring_data(
    current_user=Depends(require_admin),
):
    """清空所有监控数据"""
    performance_monitor.clear()
    return success_response(message="监控数据已清空")


@router.get(
    "/config",
    summary="获取 LangChain 配置",
    response_model=ResponseModel[dict],
)
async def get_langchain_config(
    current_user=Depends(require_admin),
):
    """获取当前 LangChain 配置"""
    return success_response(data={
        "enable_langchain": langchain_config.enable_langchain,
        "enable_langchain_rag": langchain_config.enable_langchain_rag,
        "enable_langchain_chat": langchain_config.enable_langchain_chat,
        "enable_langchain_paragraph": langchain_config.enable_langchain_paragraph,
        "enable_langchain_workflow": langchain_config.enable_langchain_workflow,
        "llm_model": langchain_config.llm_model,
        "llm_temperature": langchain_config.llm_temperature,
        "llm_max_tokens": langchain_config.llm_max_tokens,
        "retrieval_top_k": langchain_config.retrieval_top_k,
        "memory_type": langchain_config.memory_type,
        "langsmith_tracing": langchain_config.langsmith_tracing,
    })
