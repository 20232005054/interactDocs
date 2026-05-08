"""
工具调用追踪器

记录工具调用的详细信息，用于调试和分析
"""

import logging
import time
from typing import Any, Dict, List, Optional
from datetime import datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class ToolCallRecord:
    """工具调用记录"""
    
    def __init__(
        self,
        tool_name: str,
        input_args: Dict[str, Any],
        output_result: Optional[str] = None,
        execution_time: Optional[float] = None,
        error: Optional[str] = None,
        user_confirmed: bool = False,
    ):
        self.call_id = str(uuid4())
        self.tool_name = tool_name
        self.input_args = input_args
        self.output_result = output_result
        self.execution_time = execution_time
        self.error = error
        self.user_confirmed = user_confirmed
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "input_args": self.input_args,
            "output_result": self.output_result,
            "execution_time": self.execution_time,
            "error": self.error,
            "user_confirmed": self.user_confirmed,
            "timestamp": self.timestamp.isoformat(),
        }


class ToolCallTracker:
    """工具调用追踪器"""
    
    def __init__(self):
        self.records: List[ToolCallRecord] = []
    
    def start_call(self, tool_name: str, input_args: Dict[str, Any]) -> str:
        """
        开始工具调用
        
        Args:
            tool_name: 工具名称
            input_args: 输入参数
        
        Returns:
            调用 ID
        """
        record = ToolCallRecord(
            tool_name=tool_name,
            input_args=input_args,
        )
        self.records.append(record)
        
        logger.info(
            f"工具调用开始: call_id={record.call_id} "
            f"tool={tool_name} args={input_args}"
        )
        
        return record.call_id
    
    def end_call(
        self,
        call_id: str,
        output_result: Optional[str] = None,
        execution_time: Optional[float] = None,
        error: Optional[str] = None,
    ):
        """
        结束工具调用
        
        Args:
            call_id: 调用 ID
            output_result: 输出结果
            execution_time: 执行时间（秒）
            error: 错误信息
        """
        # 查找记录
        record = None
        for r in self.records:
            if r.call_id == call_id:
                record = r
                break
        
        if not record:
            logger.warning(f"工具调用记录不存在: call_id={call_id}")
            return
        
        # 更新记录
        record.output_result = output_result
        record.execution_time = execution_time
        record.error = error
        
        if error:
            logger.error(
                f"工具调用失败: call_id={call_id} "
                f"tool={record.tool_name} error={error}"
            )
        else:
            logger.info(
                f"工具调用完成: call_id={call_id} "
                f"tool={record.tool_name} time={execution_time:.3f}s"
            )
    
    def confirm_call(self, call_id: str):
        """
        确认工具调用（用于写入工具）
        
        Args:
            call_id: 调用 ID
        """
        for record in self.records:
            if record.call_id == call_id:
                record.user_confirmed = True
                logger.info(f"工具调用已确认: call_id={call_id}")
                break
    
    def get_records(
        self,
        tool_name: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[ToolCallRecord]:
        """
        获取调用记录
        
        Args:
            tool_name: 工具名称（可选）
            limit: 返回数量限制
        
        Returns:
            调用记录列表
        """
        records = self.records
        
        # 过滤工具名称
        if tool_name:
            records = [r for r in records if r.tool_name == tool_name]
        
        # 限制数量
        if limit:
            records = records[-limit:]
        
        return records
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        total_calls = len(self.records)
        success_calls = len([r for r in self.records if r.error is None])
        failed_calls = len([r for r in self.records if r.error is not None])
        
        # 按工具统计
        tool_stats = {}
        for record in self.records:
            if record.tool_name not in tool_stats:
                tool_stats[record.tool_name] = {
                    "total": 0,
                    "success": 0,
                    "failed": 0,
                    "avg_time": 0.0,
                }
            
            tool_stats[record.tool_name]["total"] += 1
            if record.error is None:
                tool_stats[record.tool_name]["success"] += 1
            else:
                tool_stats[record.tool_name]["failed"] += 1
            
            if record.execution_time:
                tool_stats[record.tool_name]["avg_time"] += record.execution_time
        
        # 计算平均时间
        for tool_name, stats in tool_stats.items():
            if stats["total"] > 0:
                stats["avg_time"] /= stats["total"]
        
        return {
            "total_calls": total_calls,
            "success_calls": success_calls,
            "failed_calls": failed_calls,
            "success_rate": success_calls / total_calls if total_calls > 0 else 0,
            "tool_stats": tool_stats,
        }
    
    def clear(self):
        """清空记录"""
        self.records.clear()
        logger.info("工具调用记录已清空")


# 全局追踪器实例
_global_tracker = ToolCallTracker()


def get_tracker() -> ToolCallTracker:
    """获取全局追踪器"""
    return _global_tracker


def track_tool_call(tool_name: str, input_args: Dict[str, Any]):
    """
    工具调用装饰器
    
    Args:
        tool_name: 工具名称
        input_args: 输入参数
    
    Returns:
        装饰器函数
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            tracker = get_tracker()
            call_id = tracker.start_call(tool_name, input_args)
            
            start_time = time.time()
            error = None
            result = None
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                execution_time = time.time() - start_time
                tracker.end_call(
                    call_id=call_id,
                    output_result=result,
                    execution_time=execution_time,
                    error=error,
                )
        
        return wrapper
    return decorator
