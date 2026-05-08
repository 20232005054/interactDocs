"""
可观测性配置

提供统一的日志、指标、追踪配置，集成 LangSmith
"""

import logging
import time
import os
from typing import Optional, Dict, Any, List
from functools import wraps
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass, field
import json


# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


# LangSmith 集成
def setup_langsmith():
    """设置 LangSmith 追踪"""
    langsmith_enabled = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true"
    
    if langsmith_enabled:
        langsmith_api_key = os.getenv("LANGCHAIN_API_KEY")
        langsmith_project = os.getenv("LANGCHAIN_PROJECT", "interactive-docs")
        
        if langsmith_api_key:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = langsmith_api_key
            os.environ["LANGCHAIN_PROJECT"] = langsmith_project
            
            logger.info(f"[LangSmith] 已启用追踪 project={langsmith_project}")
        else:
            logger.warning("[LangSmith] 未配置 API Key，追踪已禁用")
    else:
        logger.info("[LangSmith] 追踪已禁用")


# 启动时设置 LangSmith
setup_langsmith()


@dataclass
class MetricRecord:
    """指标记录"""
    timestamp: datetime
    operation: str
    success: bool
    duration_ms: float
    tokens: int = 0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class MetricsCollector:
    """
    增强的指标收集器
    
    功能：
    1. 记录详细的调用指标
    2. 按时间窗口聚合
    3. 支持自定义维度
    4. 导出到监控系统
    """
    
    def __init__(self, max_records: int = 10000):
        self.records: List[MetricRecord] = []
        self.max_records = max_records
        
        # 聚合指标
        self.aggregated_metrics: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "total_calls": 0,
                "success_calls": 0,
                "failed_calls": 0,
                "total_duration_ms": 0,
                "total_tokens": 0,
                "errors": [],
            }
        )
    
    def record_call(
        self,
        operation: str,
        success: bool,
        duration_ms: float,
        tokens: int = 0,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        记录调用
        
        Args:
            operation: 操作名称
            success: 是否成功
            duration_ms: 执行时间（毫秒）
            tokens: Token 数量
            error: 错误信息
            metadata: 元数据
        """
        # 创建记录
        record = MetricRecord(
            timestamp=datetime.now(),
            operation=operation,
            success=success,
            duration_ms=duration_ms,
            tokens=tokens,
            error=error,
            metadata=metadata or {},
        )
        
        self.records.append(record)
        
        # 限制记录数量
        if len(self.records) > self.max_records:
            self.records = self.records[-self.max_records:]
        
        # 更新聚合指标
        agg = self.aggregated_metrics[operation]
        agg["total_calls"] += 1
        if success:
            agg["success_calls"] += 1
        else:
            agg["failed_calls"] += 1
            if error:
                agg["errors"].append({
                    "timestamp": record.timestamp.isoformat(),
                    "error": error,
                })
        agg["total_duration_ms"] += duration_ms
        agg["total_tokens"] += tokens
    
    def get_metrics(self, operation: Optional[str] = None) -> Dict[str, Any]:
        """
        获取指标
        
        Args:
            operation: 操作名称，None 表示所有操作
        
        Returns:
            指标字典
        """
        if operation:
            return self._calculate_metrics(operation)
        else:
            return {
                op: self._calculate_metrics(op)
                for op in self.aggregated_metrics.keys()
            }
    
    def _calculate_metrics(self, operation: str) -> Dict[str, Any]:
        """计算指标"""
        agg = self.aggregated_metrics[operation]
        total = agg["total_calls"]
        
        if total == 0:
            return agg
        
        return {
            **agg,
            "success_rate": agg["success_calls"] / total,
            "failure_rate": agg["failed_calls"] / total,
            "avg_duration_ms": agg["total_duration_ms"] / total,
            "avg_tokens": agg["total_tokens"] / total if agg["total_tokens"] > 0 else 0,
            "recent_errors": agg["errors"][-10:],  # 最近 10 个错误
        }
    
    def get_time_series(
        self,
        operation: Optional[str] = None,
        window_minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        获取时间序列数据
        
        Args:
            operation: 操作名称
            window_minutes: 时间窗口（分钟）
        
        Returns:
            时间序列数据
        """
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        
        # 过滤记录
        filtered_records = [
            r for r in self.records
            if r.timestamp >= cutoff_time
            and (operation is None or r.operation == operation)
        ]
        
        # 按分钟聚合
        time_series = defaultdict(lambda: {
            "timestamp": None,
            "total_calls": 0,
            "success_calls": 0,
            "failed_calls": 0,
            "avg_duration_ms": 0,
            "total_tokens": 0,
        })
        
        for record in filtered_records:
            # 按分钟分组
            minute_key = record.timestamp.replace(second=0, microsecond=0)
            ts = time_series[minute_key]
            
            ts["timestamp"] = minute_key.isoformat()
            ts["total_calls"] += 1
            if record.success:
                ts["success_calls"] += 1
            else:
                ts["failed_calls"] += 1
            ts["avg_duration_ms"] += record.duration_ms
            ts["total_tokens"] += record.tokens
        
        # 计算平均值
        result = []
        for ts in time_series.values():
            if ts["total_calls"] > 0:
                ts["avg_duration_ms"] /= ts["total_calls"]
            result.append(ts)
        
        # 按时间排序
        result.sort(key=lambda x: x["timestamp"])
        
        return result
    
    def get_error_summary(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        获取错误摘要
        
        Args:
            limit: 返回数量
        
        Returns:
            错误列表
        """
        errors = [
            {
                "timestamp": r.timestamp.isoformat(),
                "operation": r.operation,
                "error": r.error,
                "duration_ms": r.duration_ms,
                "metadata": r.metadata,
            }
            for r in self.records
            if not r.success
        ]
        
        return errors[-limit:]
    
    def export_to_json(self, filepath: str):
        """导出到 JSON 文件"""
        data = {
            "exported_at": datetime.now().isoformat(),
            "total_records": len(self.records),
            "metrics": self.get_metrics(),
            "time_series": self.get_time_series(window_minutes=60),
            "recent_errors": self.get_error_summary(limit=50),
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"[指标导出] 已导出到 {filepath}")
    
    def reset(self, operation: Optional[str] = None):
        """
        重置指标
        
        Args:
            operation: 操作名称，None 表示重置所有
        """
        if operation:
            self.aggregated_metrics[operation] = {
                "total_calls": 0,
                "success_calls": 0,
                "failed_calls": 0,
                "total_duration_ms": 0,
                "total_tokens": 0,
                "errors": [],
            }
            self.records = [r for r in self.records if r.operation != operation]
        else:
            self.records.clear()
            self.aggregated_metrics.clear()


# 全局指标收集器
metrics_collector = MetricsCollector()


def track_performance(operation_name: str, include_langsmith: bool = True):
    """
    性能追踪装饰器
    
    Args:
        operation_name: 操作名称
        include_langsmith: 是否包含 LangSmith 追踪
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            success = False
            error = None
            tokens = 0
            metadata = {}
            
            try:
                result = await func(*args, **kwargs)
                success = True
                
                # 尝试提取 token 信息
                if isinstance(result, dict):
                    tokens = result.get("tokens", 0)
                    metadata = result.get("metadata", {})
                
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                # 记录日志
                if success:
                    logger.info(
                        f"[{operation_name}] 成功 duration_ms={duration_ms:.2f} tokens={tokens}"
                    )
                else:
                    logger.error(
                        f"[{operation_name}] 失败 duration_ms={duration_ms:.2f} error={error}"
                    )
                
                # 记录指标
                metrics_collector.record_call(
                    operation=operation_name,
                    success=success,
                    duration_ms=duration_ms,
                    tokens=tokens,
                    error=error,
                    metadata=metadata,
                )
        
        return wrapper
    return decorator


@asynccontextmanager
async def trace_operation(operation_name: str, **context):
    """
    操作追踪上下文管理器
    
    Args:
        operation_name: 操作名称
        **context: 上下文信息
    """
    start_time = time.perf_counter()
    logger.info(f"[{operation_name}] 开始 context={context}")
    
    error = None
    try:
        yield
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"[{operation_name}] 完成 duration_ms={duration_ms:.2f}")
        metrics_collector.record_call(
            operation=operation_name,
            success=True,
            duration_ms=duration_ms,
            metadata=context,
        )
    except Exception as e:
        error = str(e)
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(f"[{operation_name}] 失败 duration_ms={duration_ms:.2f} error={e}")
        metrics_collector.record_call(
            operation=operation_name,
            success=False,
            duration_ms=duration_ms,
            error=error,
            metadata=context,
        )
        raise


def get_metrics(operation: Optional[str] = None) -> Dict[str, Any]:
    """
    获取全局指标
    
    Args:
        operation: 操作名称，None 表示所有操作
    """
    return metrics_collector.get_metrics(operation)


def get_time_series(operation: Optional[str] = None, window_minutes: int = 60) -> List[Dict[str, Any]]:
    """
    获取时间序列数据
    
    Args:
        operation: 操作名称
        window_minutes: 时间窗口（分钟）
    """
    return metrics_collector.get_time_series(operation, window_minutes)


def get_error_summary(limit: int = 20) -> List[Dict[str, Any]]:
    """获取错误摘要"""
    return metrics_collector.get_error_summary(limit)


def export_metrics(filepath: str):
    """导出指标到文件"""
    metrics_collector.export_to_json(filepath)


def reset_metrics(operation: Optional[str] = None):
    """
    重置全局指标
    
    Args:
        operation: 操作名称，None 表示重置所有
    """
    metrics_collector.reset(operation)
