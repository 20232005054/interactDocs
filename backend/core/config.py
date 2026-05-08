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
    "postgresql+asyncpg://postgres:nrryyn8426@127.0.0.1:5432/inter"
)
# DB_ECHO=true 时输出所有 SQL 语句（调试用），默认关闭
DB_ECHO: bool = os.getenv("DB_ECHO", "false").lower() == "true"

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
# 文件存储
# ============================================================
# STORAGE_BACKEND: local（默认）或 oss（阿里云）
STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")

# 本地存储配置（STORAGE_BACKEND=local 时生效）
LOCAL_STORAGE_PATH: str = os.getenv("LOCAL_STORAGE_PATH", os.path.join(os.path.dirname(__file__), "..", "static"))
LOCAL_STORAGE_URL_PREFIX: str = os.getenv("LOCAL_STORAGE_URL_PREFIX", "/static")

# 阿里云 OSS 配置（STORAGE_BACKEND=oss 时生效）
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

# ============================================================
# LangChain 配置
# ============================================================
# LLM 配置
LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "2000"))

# 检索配置
RETRIEVAL_TOP_K: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))
RETRIEVAL_FETCH_K: int = int(os.getenv("RETRIEVAL_FETCH_K", "20"))

# 记忆配置
MEMORY_TYPE: str = os.getenv("MEMORY_TYPE", "buffer_window")  # buffer_window, summary_buffer
MEMORY_MAX_TOKEN_LIMIT: int = int(os.getenv("MEMORY_MAX_TOKEN_LIMIT", "2000"))
MEMORY_BUFFER_WINDOW: int = int(os.getenv("MEMORY_BUFFER_WINDOW", "5"))

# ============================================================
# 告警系统
# ============================================================
# 邮件告警配置
ALERT_EMAIL_ENABLED: bool = os.getenv("ALERT_EMAIL_ENABLED", "false").lower() == "true"
ALERT_EMAIL_HOST: str = os.getenv("ALERT_EMAIL_HOST", "smtp.gmail.com")
ALERT_EMAIL_PORT: int = int(os.getenv("ALERT_EMAIL_PORT", "587"))
ALERT_EMAIL_USER: str = os.getenv("ALERT_EMAIL_USER", "")
ALERT_EMAIL_PASSWORD: str = os.getenv("ALERT_EMAIL_PASSWORD", "")
ALERT_EMAIL_FROM: str = os.getenv("ALERT_EMAIL_FROM", "")
ALERT_EMAIL_TO: str = os.getenv("ALERT_EMAIL_TO", "")

# Webhook 告警配置（钉钉、Slack、企业微信等）
ALERT_WEBHOOK_ENABLED: bool = os.getenv("ALERT_WEBHOOK_ENABLED", "false").lower() == "true"
ALERT_WEBHOOK_URL: str = os.getenv("ALERT_WEBHOOK_URL", "")
ALERT_WEBHOOK_TYPE: str = os.getenv("ALERT_WEBHOOK_TYPE", "dingtalk")  # dingtalk, slack, wecom, generic
