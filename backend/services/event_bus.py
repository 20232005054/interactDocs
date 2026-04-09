"""
SSE 事件总线（Redis Pub/Sub 实现）

使用 Redis Pub/Sub 替代内存队列，支持多 worker 部署。
每个文档对应一个 channel：doc:{document_id}

配置：redis://localhost:6379/5（DB5，无密码）
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from core.config import REDIS_URL

logger = logging.getLogger(__name__)

# 发布用的单例连接（复用）
_publisher: aioredis.Redis | None = None


def _channel(document_id: str) -> str:
    return f"doc:{document_id}"


async def _get_publisher() -> aioredis.Redis:
    global _publisher
    if _publisher is None:
        _publisher = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _publisher


async def publish(document_id: str, event: dict) -> None:
    """向订阅该文档的所有连接推送事件"""
    try:
        pub = await _get_publisher()
        await pub.publish(_channel(document_id), json.dumps(event, ensure_ascii=False))
    except Exception as e:
        logger.error("Redis publish 失败 document_id=%s: %s", document_id, e)


async def event_generator(document_id: str) -> AsyncGenerator[str, None]:
    """SSE 生成器：订阅 Redis channel，持续推送事件，30s 无消息发送心跳"""
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
                    yield "data: {\"type\": \"ping\"}\n\n"
                    last_ping = asyncio.get_event_loop().time()
    finally:
        await pubsub.unsubscribe(_channel(document_id))
        await client.aclose()
