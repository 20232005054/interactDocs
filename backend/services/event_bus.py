"""
SSE 事件总线

优先使用 Redis Pub/Sub（支持多 worker 部署）。
Redis 不可用时自动降级到进程内 asyncio.Queue（单进程，开发/测试够用）。

启动时调用 init() 探测 Redis 可用性，决定运行模式。
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from core.config import REDIS_URL

logger = logging.getLogger(__name__)

# 运行模式标志，由 init() 设置
_use_redis: bool = False

# Redis 发布用单例连接
_publisher: aioredis.Redis | None = None

# 内存模式：document_id -> list of asyncio.Queue
_memory_queues: dict[str, list[asyncio.Queue]] = {}


def _channel(document_id: str) -> str:
    return f"doc:{document_id}"


async def init() -> None:
    """应用启动时调用，探测 Redis 可用性，决定运行模式"""
    global _use_redis, _publisher
    try:
        client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await client.ping()
        _publisher = client
        _use_redis = True
        logger.info("event_bus: Redis 模式 (%s)", REDIS_URL)
    except Exception as e:
        _use_redis = False
        logger.warning("event_bus: Redis 不可用，降级到内存模式（不支持多 worker）: %s", e)


# ---------------------------------------------------------------------------
# 发布
# ---------------------------------------------------------------------------

async def publish(document_id: str, event: dict) -> None:
    """向订阅该文档的所有连接推送事件"""
    if _use_redis:
        try:
            await _publisher.publish(_channel(document_id), json.dumps(event, ensure_ascii=False))
        except Exception as e:
            logger.error("Redis publish 失败 document_id=%s: %s", document_id, e)
    else:
        queues = _memory_queues.get(document_id, [])
        for q in list(queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


# ---------------------------------------------------------------------------
# 订阅（SSE 生成器）
# ---------------------------------------------------------------------------

async def event_generator(document_id: str) -> AsyncGenerator[str, None]:
    """SSE 生成器：持续推送事件，30s 无消息发送心跳"""
    if _use_redis:
        async for chunk in _redis_generator(document_id):
            yield chunk
    else:
        async for chunk in _memory_generator(document_id):
            yield chunk


async def _redis_generator(document_id: str) -> AsyncGenerator[str, None]:
    client = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(_channel(document_id))
    try:
        last_ping = asyncio.get_event_loop().time()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                yield f"data: {message['data']}\n\n"
                last_ping = asyncio.get_event_loop().time()
            else:
                await asyncio.sleep(0.5)
                if asyncio.get_event_loop().time() - last_ping >= 30:
                    yield 'data: {"type": "ping"}\n\n'
                    last_ping = asyncio.get_event_loop().time()
    finally:
        await pubsub.unsubscribe(_channel(document_id))
        await client.aclose()


async def _memory_generator(document_id: str) -> AsyncGenerator[str, None]:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _memory_queues.setdefault(document_id, []).append(queue)
    try:
        last_ping = asyncio.get_event_loop().time()
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                last_ping = asyncio.get_event_loop().time()
            except asyncio.TimeoutError:
                if asyncio.get_event_loop().time() - last_ping >= 30:
                    yield 'data: {"type": "ping"}\n\n'
                    last_ping = asyncio.get_event_loop().time()
    finally:
        queues = _memory_queues.get(document_id, [])
        if queue in queues:
            queues.remove(queue)
        if not queues:
            _memory_queues.pop(document_id, None)
