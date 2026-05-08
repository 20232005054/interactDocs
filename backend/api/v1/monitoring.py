"""
性能监控接口

GET  /api/v1/monitoring/metrics      获取指标
GET  /api/v1/monitoring/metrics/timeseries  获取时间序列
GET  /api/v1/monitoring/alerts/active  获取活跃告警
GET  /api/v1/monitoring/logs/search  搜索日志
GET  /api/v1/monitoring/health       健康检查
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime

from core.auth import get_current_user, get_admin_user
from core.response import success_response, ResponseModel
from core.config import AI_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS, RETRIEVAL_TOP_K, MEMORY_TYPE
from core.observability import (
    get_metrics,
    get_time_series,
    get_error_summary,
    export_metrics,
    reset_metrics,
)
from core.alert_system import (
    alert_system,
    get_active_alerts,
    get_alert_history,
    AlertLevel,
    AlertType,
)
from core.log_aggregator import (
    log_aggregator,
    search_logs,
    get_log_statistics,
    export_logs,
    LogLevel,
)

router = APIRouter(prefix="/api/v1/monitoring", tags=["性能监控"])


@router.get(
    "/config",
    summary="获取 AI 配置",
    response_model=ResponseModel[dict],
)
async def get_ai_config(
    current_user=Depends(get_admin_user),
):
    """获取当前 AI 配置"""
    return success_response(data={
        "ai_model": AI_MODEL,
        "llm_temperature": LLM_TEMPERATURE,
        "llm_max_tokens": LLM_MAX_TOKENS,
        "retrieval_top_k": RETRIEVAL_TOP_K,
        "memory_type": MEMORY_TYPE,
    })


# ==================== 指标 API ====================

@router.get(
    "/metrics",
    summary="获取指标",
    response_model=ResponseModel[dict],
)
async def get_metrics_api(
    operation: Optional[str] = None,
    current_user=Depends(get_admin_user),
):
    """
    获取指标
    
    Args:
        operation: 操作名称，None 表示所有操作
    """
    metrics = get_metrics(operation)
    return success_response(data=metrics)


@router.get(
    "/metrics/timeseries",
    summary="获取时间序列",
    response_model=ResponseModel[list],
)
async def get_metrics_timeseries(
    operation: Optional[str] = None,
    window_minutes: int = 60,
    current_user=Depends(get_admin_user),
):
    """
    获取时间序列数据
    
    Args:
        operation: 操作名称
        window_minutes: 时间窗口（分钟）
    """
    data = get_time_series(operation, window_minutes)
    return success_response(data=data)


@router.get(
    "/metrics/errors",
    summary="获取错误摘要",
    response_model=ResponseModel[list],
)
async def get_metrics_errors(
    limit: int = 20,
    current_user=Depends(get_admin_user),
):
    """
    获取错误摘要
    
    Args:
        limit: 返回数量
    """
    errors = get_error_summary(limit)
    return success_response(data=errors)


# ==================== 告警 API ====================

@router.get(
    "/alerts/active",
    summary="获取活跃告警",
    response_model=ResponseModel[list],
)
async def get_active_alerts_api(
    level: Optional[str] = None,
    current_user=Depends(get_admin_user),
):
    """
    获取活跃告警
    
    Args:
        level: 告警级别（info/warning/error/critical）
    """
    alert_level = AlertLevel(level) if level else None
    alerts = get_active_alerts(alert_level)
    
    return success_response(data=[
        {
            "alert_type": a.alert_type.value,
            "level": a.level.value,
            "message": a.message,
            "timestamp": a.timestamp.isoformat(),
            "resolved": a.resolved,
            "metadata": a.metadata,
        }
        for a in alerts
    ])


@router.get(
    "/alerts/history",
    summary="获取告警历史",
    response_model=ResponseModel[list],
)
async def get_alert_history_api(
    limit: int = 50,
    alert_type: Optional[str] = None,
    current_user=Depends(get_admin_user),
):
    """
    获取告警历史
    
    Args:
        limit: 返回数量
        alert_type: 告警类型
    """
    alert_type_enum = AlertType(alert_type) if alert_type else None
    alerts = get_alert_history(limit, alert_type_enum)
    
    return success_response(data=[
        {
            "alert_type": a.alert_type.value,
            "level": a.level.value,
            "message": a.message,
            "timestamp": a.timestamp.isoformat(),
            "resolved": a.resolved,
            "metadata": a.metadata,
        }
        for a in alerts
    ])


@router.post(
    "/alerts/clear",
    summary="清空告警",
    response_model=ResponseModel[None],
)
async def clear_alerts(
    current_user=Depends(get_admin_user),
):
    """清空所有告警"""
    alert_system.clear_alerts()
    return success_response(message="告警已清空")


# ==================== 日志 API ====================

@router.get(
    "/logs/search",
    summary="搜索日志",
    response_model=ResponseModel[list],
)
async def search_logs_api(
    level: Optional[str] = None,
    operation: Optional[str] = None,
    user_id: Optional[str] = None,
    document_id: Optional[str] = None,
    keyword: Optional[str] = None,
    time_range_minutes: Optional[int] = None,
    limit: int = 100,
    current_user=Depends(get_admin_user),
):
    """
    搜索日志
    
    Args:
        level: 日志级别
        operation: 操作名称
        user_id: 用户 ID
        document_id: 文档 ID
        keyword: 关键词
        time_range_minutes: 时间范围（分钟）
        limit: 返回数量
    """
    log_level = LogLevel(level) if level else None
    logs = search_logs(
        level=log_level,
        operation=operation,
        user_id=user_id,
        document_id=document_id,
        keyword=keyword,
        time_range_minutes=time_range_minutes,
        limit=limit,
    )
    
    return success_response(data=[
        {
            "timestamp": log.timestamp.isoformat(),
            "level": log.level.value,
            "logger_name": log.logger_name,
            "message": log.message,
            "operation": log.operation,
            "user_id": log.user_id,
            "document_id": log.document_id,
            "error": log.error,
        }
        for log in logs
    ])


@router.get(
    "/logs/statistics",
    summary="获取日志统计",
    response_model=ResponseModel[dict],
)
async def get_log_statistics_api(
    time_range_minutes: int = 60,
    current_user=Depends(get_admin_user),
):
    """
    获取日志统计
    
    Args:
        time_range_minutes: 时间范围（分钟）
    """
    stats = get_log_statistics(time_range_minutes)
    return success_response(data=stats)


# ==================== 健康检查 API ====================

@router.get(
    "/health",
    summary="健康检查",
    response_model=ResponseModel[dict],
)
async def health_check():
    """健康检查（无需认证）"""
    # 获取最近 5 分钟的指标
    metrics = get_metrics()
    alerts = get_active_alerts()
    log_stats = get_log_statistics(time_range_minutes=5)
    
    # 判断健康状态
    critical_alerts = [a for a in alerts if a.level == AlertLevel.CRITICAL]
    error_rate = log_stats.get("error_count", 0) / max(log_stats.get("total_logs", 1), 1)
    
    if critical_alerts or error_rate > 0.5:
        status = "unhealthy"
    elif alerts or error_rate > 0.1:
        status = "degraded"
    else:
        status = "healthy"
    
    return success_response(data={
        "status": status,
        "timestamp": datetime.now().isoformat(),
        "metrics_summary": {
            "total_operations": len(metrics) if isinstance(metrics, dict) else 0,
        },
        "alerts_summary": {
            "total_active": len(alerts),
            "critical": len(critical_alerts),
        },
        "logs_summary": {
            "total_logs_5min": log_stats.get("total_logs", 0),
            "error_count_5min": log_stats.get("error_count", 0),
            "error_rate": error_rate,
        },
    })

