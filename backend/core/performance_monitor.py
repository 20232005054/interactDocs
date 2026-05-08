"""
性能监控

监控 v1/v2 服务的性能指标，用于对比和优化
"""

import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """性能指标"""
    service_version: str  # v1 or v2
    feature: str  # rag, chat, paragraph, workflow
    method: str  # 方法名
    duration: float  # 执行时间（秒）
    success: bool  # 是否成功
    error: Optional[str] = None  # 错误信息
    timestamp: datetime = field(default_factory=datetime.now)


class PerformanceMonitor:
    """
    性能监控器
    
    收集和分析 v1/v2 服务的性能指标
    """
    
    def __init__(self):
        self.metrics: List[PerformanceMetric] = []
        self.max_metrics = 10000  # 最多保留 10000 条记录
    
    def record(
        self,
        service_version: str,
        feature: str,
        method: str,
        duration: float,
        success: bool,
        error: Optional[str] = None,
    ):
        """
        记录性能指标
        
        Args:
            service_version: 服务版本（v1/v2）
            feature: 功能名称
            method: 方法名
            duration: 执行时间（秒）
            success: 是否成功
            error: 错误信息
        """
        metric = PerformanceMetric(
            service_version=service_version,
            feature=feature,
            method=method,
            duration=duration,
            success=success,
            error=error,
        )
        
        self.metrics.append(metric)
        
        # 限制记录数量
        if len(self.metrics) > self.max_metrics:
            self.metrics = self.metrics[-self.max_metrics:]
        
        # 记录日志
        status = "成功" if success else "失败"
        logger.info(
            f"[性能监控] {service_version} {feature}.{method} "
            f"{status} duration={duration:.2f}s"
        )
        
        if error:
            logger.error(f"[性能监控] 错误: {error}")
    
    def get_statistics(
        self,
        service_version: Optional[str] = None,
        feature: Optional[str] = None,
        method: Optional[str] = None,
    ) -> Dict:
        """
        获取统计信息
        
        Args:
            service_version: 过滤服务版本
            feature: 过滤功能
            method: 过滤方法
        
        Returns:
            统计信息字典
        """
        # 过滤指标
        filtered_metrics = self.metrics
        
        if service_version:
            filtered_metrics = [m for m in filtered_metrics if m.service_version == service_version]
        
        if feature:
            filtered_metrics = [m for m in filtered_metrics if m.feature == feature]
        
        if method:
            filtered_metrics = [m for m in filtered_metrics if m.method == method]
        
        if not filtered_metrics:
            return {
                "total_count": 0,
                "success_count": 0,
                "failure_count": 0,
                "success_rate": 0.0,
                "avg_duration": 0.0,
                "min_duration": 0.0,
                "max_duration": 0.0,
                "p50_duration": 0.0,
                "p95_duration": 0.0,
                "p99_duration": 0.0,
            }
        
        # 计算统计信息
        total_count = len(filtered_metrics)
        success_count = sum(1 for m in filtered_metrics if m.success)
        failure_count = total_count - success_count
        success_rate = success_count / total_count if total_count > 0 else 0.0
        
        durations = [m.duration for m in filtered_metrics]
        avg_duration = statistics.mean(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        sorted_durations = sorted(durations)
        p50_duration = sorted_durations[int(len(sorted_durations) * 0.5)]
        p95_duration = sorted_durations[int(len(sorted_durations) * 0.95)]
        p99_duration = sorted_durations[int(len(sorted_durations) * 0.99)]
        
        return {
            "total_count": total_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "success_rate": success_rate,
            "avg_duration": avg_duration,
            "min_duration": min_duration,
            "max_duration": max_duration,
            "p50_duration": p50_duration,
            "p95_duration": p95_duration,
            "p99_duration": p99_duration,
        }
    
    def compare_versions(self, feature: str, method: str) -> Dict:
        """
        对比 v1 和 v2 的性能
        
        Args:
            feature: 功能名称
            method: 方法名
        
        Returns:
            对比结果
        """
        v1_stats = self.get_statistics("v1", feature, method)
        v2_stats = self.get_statistics("v2", feature, method)
        
        # 计算改进百分比
        def calc_improvement(v1_val, v2_val):
            if v1_val == 0:
                return 0.0
            return ((v1_val - v2_val) / v1_val) * 100
        
        return {
            "v1": v1_stats,
            "v2": v2_stats,
            "improvements": {
                "duration": calc_improvement(
                    v1_stats["avg_duration"],
                    v2_stats["avg_duration"]
                ),
                "success_rate": calc_improvement(
                    1 - v1_stats["success_rate"],
                    1 - v2_stats["success_rate"]
                ),
            }
        }
    
    def get_recent_failures(self, limit: int = 10) -> List[PerformanceMetric]:
        """
        获取最近的失败记录
        
        Args:
            limit: 返回数量
        
        Returns:
            失败记录列表
        """
        failures = [m for m in self.metrics if not m.success]
        return failures[-limit:]
    
    def clear(self):
        """清空所有记录"""
        self.metrics.clear()
        logger.info("[性能监控] 已清空所有记录")


# 全局监控器实例
performance_monitor = PerformanceMonitor()


def monitor_performance(service_version: str, feature: str, method: str):
    """
    性能监控装饰器
    
    Args:
        service_version: 服务版本（v1/v2）
        feature: 功能名称
        method: 方法名
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = False
            error = None
            
            try:
                result = await func(*args, **kwargs)
                success = True
                return result
            
            except Exception as e:
                error = str(e)
                raise
            
            finally:
                duration = time.time() - start_time
                performance_monitor.record(
                    service_version=service_version,
                    feature=feature,
                    method=method,
                    duration=duration,
                    success=success,
                    error=error,
                )
        
        return wrapper
    return decorator
