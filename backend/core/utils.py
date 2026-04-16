"""
通用工具函数
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


def log_task_exception(task: asyncio.Task) -> None:
    """
    asyncio.Task done callback：任务异常时记录完整 traceback。

    用法：
        task = asyncio.create_task(some_coro(), name="task_name")
        task.add_done_callback(log_task_exception)
    """
    if task.cancelled():
        return
    exc = task.exception()
    if exc:
        logger.exception(
            "后台任务异常 [%s]: %s",
            task.get_name(),
            exc,
            exc_info=exc,
        )
