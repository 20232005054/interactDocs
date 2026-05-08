"""
日志聚合系统

收集、聚合和分析日志
"""

import logging
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum


logger = logging.getLogger(__name__)


class LogLevel(str, Enum):
    """日志级别"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class LogEntry:
    """日志条目"""
    timestamp: datetime
    level: LogLevel
    logger_name: str
    message: str
    operation: Optional[str] = None
    user_id: Optional[str] = None
    document_id: Optional[str] = None
    error: Optional[str] = None
    stack_trace: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class LogAggregator:
    """
    日志聚合器
    
    功能：
    1. 收集结构化日志
    2. 按维度聚合
    3. 错误分析
    4. 日志搜索
    """
    
    def __init__(self, max_logs: int = 10000):
        self.logs: List[LogEntry] = []
        self.max_logs = max_logs
        
        # 错误统计
        self.error_counts: Dict[str, int] = defaultdict(int)
    
    def log(
        self,
        level: LogLevel,
        message: str,
        logger_name: str = "app",
        operation: Optional[str] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        error: Optional[str] = None,
        stack_trace: Optional[str] = None,
        **metadata,
    ):
        """
        记录日志
        
        Args:
            level: 日志级别
            message: 日志消息
            logger_name: 日志器名称
            operation: 操作名称
            user_id: 用户 ID
            document_id: 文档 ID
            error: 错误信息
            stack_trace: 堆栈跟踪
            **metadata: 元数据
        """
        entry = LogEntry(
            timestamp=datetime.now(),
            level=level,
            logger_name=logger_name,
            message=message,
            operation=operation,
            user_id=user_id,
            document_id=document_id,
            error=error,
            stack_trace=stack_trace,
            metadata=metadata,
        )
        
        self.logs.append(entry)
        
        # 限制日志数量
        if len(self.logs) > self.max_logs:
            self.logs = self.logs[-self.max_logs:]
        
        # 统计错误
        if level in [LogLevel.ERROR, LogLevel.CRITICAL] and error:
            self.error_counts[error] += 1
    
    def search(
        self,
        level: Optional[LogLevel] = None,
        operation: Optional[str] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
        keyword: Optional[str] = None,
        time_range_minutes: Optional[int] = None,
        limit: int = 100,
    ) -> List[LogEntry]:
        """
        搜索日志
        
        Args:
            level: 过滤日志级别
            operation: 过滤操作
            user_id: 过滤用户
            document_id: 过滤文档
            keyword: 关键词搜索
            time_range_minutes: 时间范围（分钟）
            limit: 返回数量
        
        Returns:
            日志列表
        """
        filtered = self.logs
        
        # 时间范围过滤
        if time_range_minutes:
            cutoff = datetime.now() - timedelta(minutes=time_range_minutes)
            filtered = [log for log in filtered if log.timestamp >= cutoff]
        
        # 级别过滤
        if level:
            filtered = [log for log in filtered if log.level == level]
        
        # 操作过滤
        if operation:
            filtered = [log for log in filtered if log.operation == operation]
        
        # 用户过滤
        if user_id:
            filtered = [log for log in filtered if log.user_id == user_id]
        
        # 文档过滤
        if document_id:
            filtered = [log for log in filtered if log.document_id == document_id]
        
        # 关键词搜索
        if keyword:
            keyword_lower = keyword.lower()
            filtered = [
                log for log in filtered
                if keyword_lower in log.message.lower()
                or (log.error and keyword_lower in log.error.lower())
            ]
        
        return filtered[-limit:]
    
    def get_error_summary(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        获取错误摘要
        
        Args:
            limit: 返回数量
        
        Returns:
            错误摘要列表
        """
        # 按错误类型排序
        sorted_errors = sorted(
            self.error_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        
        return [
            {"error": error, "count": count}
            for error, count in sorted_errors[:limit]
        ]
    
    def get_log_statistics(self, time_range_minutes: int = 60) -> Dict[str, Any]:
        """
        获取日志统计
        
        Args:
            time_range_minutes: 时间范围（分钟）
        
        Returns:
            统计信息
        """
        cutoff = datetime.now() - timedelta(minutes=time_range_minutes)
        recent_logs = [log for log in self.logs if log.timestamp >= cutoff]
        
        # 按级别统计
        level_counts = defaultdict(int)
        for log in recent_logs:
            level_counts[log.level.value] += 1
        
        # 按操作统计
        operation_counts = defaultdict(int)
        for log in recent_logs:
            if log.operation:
                operation_counts[log.operation] += 1
        
        return {
            "time_range_minutes": time_range_minutes,
            "total_logs": len(recent_logs),
            "level_counts": dict(level_counts),
            "operation_counts": dict(operation_counts),
            "error_count": level_counts[LogLevel.ERROR.value] + level_counts[LogLevel.CRITICAL.value],
            "top_errors": self.get_error_summary(limit=10),
        }
    
    def export_to_json(self, filepath: str, limit: int = 1000):
        """
        导出日志到 JSON 文件
        
        Args:
            filepath: 文件路径
            limit: 导出数量
        """
        logs_data = [
            {
                "timestamp": log.timestamp.isoformat(),
                "level": log.level.value,
                "logger_name": log.logger_name,
                "message": log.message,
                "operation": log.operation,
                "user_id": log.user_id,
                "document_id": log.document_id,
                "error": log.error,
                "stack_trace": log.stack_trace,
                "metadata": log.metadata,
            }
            for log in self.logs[-limit:]
        ]
        
        data = {
            "exported_at": datetime.now().isoformat(),
            "total_logs": len(logs_data),
            "logs": logs_data,
            "statistics": self.get_log_statistics(),
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"[日志导出] 已导出 {len(logs_data)} 条日志到 {filepath}")
    
    def clear(self):
        """清空所有日志"""
        self.logs.clear()
        self.error_counts.clear()
        logger.info("[日志聚合] 已清空所有日志")


# 全局日志聚合器实例
log_aggregator = LogAggregator()


# 便捷函数
def log_info(message: str, **kwargs):
    """记录 INFO 日志"""
    log_aggregator.log(LogLevel.INFO, message, **kwargs)


def log_warning(message: str, **kwargs):
    """记录 WARNING 日志"""
    log_aggregator.log(LogLevel.WARNING, message, **kwargs)


def log_error(message: str, error: Optional[str] = None, **kwargs):
    """记录 ERROR 日志"""
    log_aggregator.log(LogLevel.ERROR, message, error=error, **kwargs)


def log_critical(message: str, error: Optional[str] = None, **kwargs):
    """记录 CRITICAL 日志"""
    log_aggregator.log(LogLevel.CRITICAL, message, error=error, **kwargs)


def search_logs(**kwargs) -> List[LogEntry]:
    """搜索日志"""
    return log_aggregator.search(**kwargs)


def get_log_statistics(time_range_minutes: int = 60) -> Dict[str, Any]:
    """获取日志统计"""
    return log_aggregator.get_log_statistics(time_range_minutes)


def export_logs(filepath: str, limit: int = 1000):
    """导出日志"""
    log_aggregator.export_to_json(filepath, limit)
