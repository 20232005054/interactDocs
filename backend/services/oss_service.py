"""
阿里云 OSS 上传服务

凭据从环境变量读取（懒加载，调用时才读取，避免模块导入时 .env 未加载）：
  OSS_ACCESS_KEY_ID
  OSS_ACCESS_KEY_SECRET
  OSS_ENDPOINT
  OSS_BUCKET_NAME
  OSS_BASE_URL  （可选，不填则自动拼接）
"""

import os
import uuid
from datetime import datetime

import oss2

# 允许的图片类型
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg"}

# 最大文件大小 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def _get_bucket() -> oss2.Bucket:
    """获取 OSS Bucket 实例（每次调用时读取环境变量，确保 .env 已加载）"""
    auth = oss2.Auth(
        os.getenv("OSS_ACCESS_KEY_ID", ""),
        os.getenv("OSS_ACCESS_KEY_SECRET", ""),
    )
    return oss2.Bucket(
        auth,
        os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com"),
        os.getenv("OSS_BUCKET_NAME", ""),
    )


def _build_object_key(filename: str) -> str:
    """生成 OSS 对象路径：images/{年月}/{uuid}.{ext}"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
    date_prefix = datetime.now().strftime("%Y%m")
    return f"images/{date_prefix}/{uuid.uuid4().hex}.{ext}"


def _build_url(object_key: str) -> str:
    """拼接图片访问 URL"""
    base_url = os.getenv("OSS_BASE_URL", "")
    if base_url:
        return f"{base_url.rstrip('/')}/{object_key}"
    bucket_name = os.getenv("OSS_BUCKET_NAME", "")
    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    return f"https://{bucket_name}.{endpoint}/{object_key}"


async def upload_image(file_content: bytes, filename: str, content_type: str) -> str:
    """
    上传图片到 OSS，返回访问 URL

    Raises:
        ValueError: 文件类型不合法或超过大小限制
        Exception: OSS 上传失败
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件类型: {content_type}")

    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError(f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）")

    object_key = _build_object_key(filename)

    import asyncio
    bucket = _get_bucket()
    await asyncio.to_thread(
        bucket.put_object,
        object_key,
        file_content,
        headers={"Content-Type": content_type},
    )

    return _build_url(object_key)
