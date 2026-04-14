"""
全局配置

所有配置项从环境变量读取，.env 文件由 main.py 启动时加载。
"""

import os


# ============================================================
# 数据库
# ============================================================
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:123456@192.168.104.52:5432/agent02"
)

# ============================================================
# Redis
# ============================================================
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/5")

# ============================================================
# JWT
# ============================================================
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 默认 7 天

# ============================================================
# 阿里云 OSS
# ============================================================
OSS_ACCESS_KEY_ID: str = os.getenv("OSS_ACCESS_KEY_ID", "")
OSS_ACCESS_KEY_SECRET: str = os.getenv("OSS_ACCESS_KEY_SECRET", "")
OSS_ENDPOINT: str = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
OSS_BUCKET_NAME: str = os.getenv("OSS_BUCKET_NAME", "")
OSS_BASE_URL: str = os.getenv("OSS_BASE_URL", "")

# ============================================================
# AI（通义千问）
# ============================================================
AI_MODEL: str = os.getenv("AI_MODEL", "qwen-max")
AI_TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "30.0"))
AI_MAX_RETRIES: int = max(int(os.getenv("AI_MAX_RETRIES", "2")), 0)
AI_RETRY_BACKOFF_SECONDS: float = max(float(os.getenv("AI_RETRY_BACKOFF_SECONDS", "0.8")), 0.0)
AI_MAX_CONCURRENCY: int = max(int(os.getenv("AI_MAX_CONCURRENCY", "5")), 1)
