"""
文件存储服务（本地存储实现）

通过 STORAGE_BACKEND 环境变量切换后端：
  STORAGE_BACKEND=local   （默认）本地磁盘，文件存放在 LOCAL_STORAGE_PATH 目录下
  STORAGE_BACKEND=oss     阿里云 OSS（需配置 OSS_* 环境变量）

本地存储目录结构：
  {LOCAL_STORAGE_PATH}/
    images/{年月}/{uuid}.{ext}
    literature/{uuid}.pdf

访问 URL：
  /static/images/{年月}/{uuid}.{ext}
  /static/literature/{uuid}.pdf
"""

import os
import uuid
from datetime import datetime

from core.config import (
    STORAGE_BACKEND,
    LOCAL_STORAGE_PATH,
    LOCAL_STORAGE_URL_PREFIX,
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
    OSS_ENDPOINT,
    OSS_BUCKET_NAME,
    OSS_BASE_URL,
)

# 允许的图片类型
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg"}

# 最大文件大小 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# 内部工具函数
# ============================================================

def _build_object_key_image(filename: str) -> str:
    """生成图片对象路径：images/{年月}/{uuid}.{ext}"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
    date_prefix = datetime.now().strftime("%Y%m")
    return f"images/{date_prefix}/{uuid.uuid4().hex}.{ext}"


# ============================================================
# 本地存储实现
# ============================================================

def _local_build_url(object_key: str) -> str:
    prefix = LOCAL_STORAGE_URL_PREFIX.rstrip("/")
    return f"{prefix}/{object_key}"


async def _local_upload(file_content: bytes, object_key: str, content_type: str) -> str:
    """写入本地磁盘，返回访问 URL"""
    dest_path = os.path.join(LOCAL_STORAGE_PATH, object_key)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    import asyncio
    await asyncio.to_thread(_write_file, dest_path, file_content)
    return _local_build_url(object_key)


def _write_file(path: str, content: bytes) -> None:
    with open(path, "wb") as f:
        f.write(content)


async def _local_delete(object_key: str) -> None:
    """删除本地文件，不存在时静默忽略"""
    dest_path = os.path.join(LOCAL_STORAGE_PATH, object_key)
    try:
        import asyncio
        await asyncio.to_thread(os.remove, dest_path)
    except FileNotFoundError:
        pass


async def _local_read(object_key: str) -> bytes:
    """读取本地文件内容"""
    dest_path = os.path.join(LOCAL_STORAGE_PATH, object_key)
    import asyncio
    return await asyncio.to_thread(_read_file, dest_path)


def _read_file(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


# ============================================================
# OSS 实现（原有逻辑，STORAGE_BACKEND=oss 时启用）
# ============================================================

def _get_bucket():
    """获取 OSS Bucket 实例（仅 STORAGE_BACKEND=oss 时调用）"""
    import oss2
    auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)


def _oss_build_url(object_key: str) -> str:
    if OSS_BASE_URL:
        return f"{OSS_BASE_URL.rstrip('/')}/{object_key}"
    return f"https://{OSS_BUCKET_NAME}.{OSS_ENDPOINT}/{object_key}"


async def _oss_upload(file_content: bytes, object_key: str, content_type: str) -> str:
    import asyncio
    bucket = _get_bucket()
    await asyncio.to_thread(
        bucket.put_object,
        object_key,
        file_content,
        headers={"Content-Type": content_type},
    )
    return _oss_build_url(object_key)


async def _oss_delete(object_key: str) -> None:
    import asyncio
    bucket = _get_bucket()
    await asyncio.to_thread(bucket.delete_object, object_key)


async def _oss_read(object_key: str) -> bytes:
    import asyncio
    bucket = _get_bucket()
    result = await asyncio.to_thread(bucket.get_object, object_key)
    return await asyncio.to_thread(result.read)


# ============================================================
# 统一公共接口（供外部调用）
# ============================================================

def build_url(object_key: str) -> str:
    if STORAGE_BACKEND == "oss":
        return _oss_build_url(object_key)
    return _local_build_url(object_key)


async def upload_file(file_content: bytes, object_key: str, content_type: str) -> str:
    """上传文件，返回访问 URL"""
    if STORAGE_BACKEND == "oss":
        return await _oss_upload(file_content, object_key, content_type)
    return await _local_upload(file_content, object_key, content_type)


async def delete_file(object_key: str) -> None:
    """删除文件"""
    if STORAGE_BACKEND == "oss":
        await _oss_delete(object_key)
    else:
        await _local_delete(object_key)


async def read_file(object_key: str) -> bytes:
    """读取文件内容"""
    if STORAGE_BACKEND == "oss":
        return await _oss_read(object_key)
    return await _local_read(object_key)


async def upload_image(file_content: bytes, filename: str, content_type: str) -> str:
    """
    上传图片，返回访问 URL

    Raises:
        ValueError: 文件类型不合法或超过大小限制
        Exception: 上传失败
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件类型: {content_type}")

    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError(f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）")

    object_key = _build_object_key_image(filename)
    return await upload_file(file_content, object_key, content_type)
