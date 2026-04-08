"""
SSE 事件总线

用内存队列实现文档级别的事件发布/订阅。
后台任务完成后调用 publish，SSE 连接读取后推给前端。

注意：单进程有效，多进程部署需换成 Redis Pub/Sub。
"""

import asyncio
import json
from collections import defaultdict
from typing import AsyncGenerator

# document_id(str) -> list of asyncio.Queue
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


def subscribe(document_id: str) -> asyncio.Queue:
    """订阅文档事件，返回一个队列"""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers[document_id].append(q)
    return q


def unsubscribe(document_id: str, q: asyncio.Queue) -> None:
    """取消订阅"""
    try:
        _subscribers[document_id].remove(q)
    except ValueError:
        pass


async def publish(document_id: str, event: dict) -> None:
    """向所有订阅该文档的连接推送事件"""
    for q in list(_subscribers.get(document_id, [])):
        await q.put(event)


async def event_generator(document_id: str) -> AsyncGenerator[str, None]:
    """SSE 生成器：持续等待事件，30s 无事件发送心跳"""
    q = subscribe(document_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30)
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield "data: {\"type\": \"ping\"}\n\n"
    finally:
        unsubscribe(document_id, q)
