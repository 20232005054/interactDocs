"""
可观测性配置

提供统一的日志、指标、追踪配置
"""

import logging
import time
from typing import Optional, Dict, Any
from functools import wraps
from contextlib import asynccontextmanager


# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


class MetricsCollector:
    """指标收集器"""
    
    def __init__(self):
        self.metrics: Dict[str, Any] = {
            "total_calls": 0,
            "success_calls": 0,
            "failed_calls": 0,
            "total_duration_ms": 0,
            "total_tokens": 0,
        }
    
    def record_call(self, success: bool, duration_ms: float, tokens: int = 0):
        """记录调用"""
        self.metrics["total_calls"] += 1
        if success:
            self.metrics["success_calls"] += 1
        else:
            self.metrics["failed_calls"] += 1
        self.metrics["total_duration_ms"] += duration_ms
        self.metrics["total_tokens"] += tokens
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取指标"""
        total = self.metrics["total_calls"]
        if total == 0:
            return self.metrics
        
        return {
            **self.metrics,
            "success_rate": self.metrics["success_calls"] / total,
            "avg_duration_ms": self.metrics["total_duration_ms"] / total,
            "avg_tokens": self.metrics["total_tokens"] / total if self.metrics["total_tokens"] > 0 else 0,
        }
    
    def reset(self):
        """重置指标"""
        self.metrics = {
            "total_calls": 0,
            "success_calls": 0,
            "failed_calls": 0,
            "total_duration_ms": 0,
            "total_tokens": 0,
        }


# 全局指标收集器
metrics_collector = MetricsCollector()


def track_performance(operation_name: str):
    """
    性能追踪装饰器
    
    Args:
        operation_name: 操作名称
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            success = False
            error = None
            
            try:
                result = await func(*args, **kwargs)
                success = True
                return result
            except Exception as e:
                error = e
                raise
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                # 记录日志
                if success:
                    logger.info(
                        f"[{operation_name}] 成功 duration_ms={duration_ms:.2f}"
                    )
                else:
                    logger.error(
                        f"[{operation_name}] 失败 duration_ms={duration_ms:.2f} error={error}"
                    )
                
                # 记录指标
                metrics_collector.record_call(success, duration_ms)
        
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
    
    try:
        yield
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"[{operation_name}] 完成 duration_ms={duration_ms:.2f}")
        metrics_collector.record_call(True, duration_ms)
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(f"[{operation_name}] 失败 duration_ms={duration_ms:.2f} error={e}")
        metrics_collector.record_call(False, duration_ms)
        raise


def get_metrics() -> Dict[str, Any]:
    """获取全局指标"""
    return metrics_collector.get_metrics()


def reset_metrics():
    """重置全局指标"""
    metrics_collector.reset()
