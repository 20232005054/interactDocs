from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.staticfiles import StaticFiles
from api.v1 import documents, chapters, paragraphs, ai, endpoints, summaries, templates, core_info, core_info_templates, summary_templates, structure_templates
from api.v1 import auth, upload, events, export, chat, literature
from api.v1.admin import users as admin_users, documents as admin_documents, stats as admin_stats, templates as admin_templates
from core.response import http_exception_handler, validation_exception_handler, generic_exception_handler
from core.security import decode_token
import os
import uvicorn
import logging
from fastapi.middleware.cors import CORSMiddleware

# 加载 .env 文件（开发环境）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# 配置日志：DEBUG 级别输出到控制台，格式含时间和模块名
# logging.DEBUG - 输出所有调试信息（最详细）
# logging.INFO - 输出一般信息（当前设置）
# logging.WARNING - 只输出警告和错误
# logging.ERROR - 只输出错误
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

# 全局 Bearer security scheme，让 Swagger 对所有业务接口显示锁图标
# auto_error=False 表示不在这里报错，实际鉴权由 Middleware 处理
_bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services import event_bus
    await event_bus.init()
    yield


app = FastAPI(
    title="方案生成系统",
    version="1.0.0",
    timeout=300,
    swagger_ui_parameters={"persistAuthorization": True},  # Swagger 刷新后保留 token
    lifespan=lifespan,
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 不需要鉴权的路径白名单
_PUBLIC_PATHS = {
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/",
}

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path in _PUBLIC_PATHS or request.url.path.startswith("/docs") or request.url.path.startswith("/static"):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=200, content={"code": 401, "message": "未提供认证凭据", "data": None})

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        decode_token(token.strip())
    except Exception:
        return JSONResponse(status_code=200, content={"code": 401, "message": "无效的认证凭据", "data": None})

    return await call_next(request)




# 业务路由统一加 Bearer security scheme（让 Swagger Authorize 生效）
_auth_dep = [Depends(_bearer)]
app.include_router(documents.router, dependencies=_auth_dep)
app.include_router(chapters.router, dependencies=_auth_dep)
app.include_router(paragraphs.router, dependencies=_auth_dep)
app.include_router(ai.router, dependencies=_auth_dep)
app.include_router(endpoints.router, dependencies=_auth_dep)
app.include_router(summaries.router, dependencies=_auth_dep)
app.include_router(templates.router, dependencies=_auth_dep)
app.include_router(core_info.router, dependencies=_auth_dep)
app.include_router(core_info_templates.router, dependencies=_auth_dep)
app.include_router(summary_templates.router, dependencies=_auth_dep)
app.include_router(structure_templates.router, dependencies=_auth_dep)
app.include_router(upload.router, dependencies=_auth_dep)
app.include_router(events.router, dependencies=_auth_dep)
app.include_router(export.router, dependencies=_auth_dep)
app.include_router(chat.router, dependencies=_auth_dep)
app.include_router(literature.router, dependencies=_auth_dep)
app.include_router(literature.template_router, dependencies=_auth_dep)
# 用户认证（公开，不加 Bearer）
app.include_router(auth.router)
# 管理员（已有 get_admin_user Depends，不需要额外加）
app.include_router(admin_users.router)
app.include_router(admin_documents.router)
app.include_router(admin_stats.router)
app.include_router(admin_templates.router)

@app.get("/")
async def root():
    return {"message": "Protocol Generation API is running."}


# 挂载本地静态文件目录（STORAGE_BACKEND=local 时提供文件访问）
from core.config import STORAGE_BACKEND, LOCAL_STORAGE_PATH
if STORAGE_BACKEND == "local":
    os.makedirs(LOCAL_STORAGE_PATH, exist_ok=True)
    app.mount("/static", StaticFiles(directory=LOCAL_STORAGE_PATH), name="static")

if __name__ == "__main__":
    import uvicorn
    # uvicorn.run(app, host="0.0.0.0", port=8001)
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True,reload_dirs=["."])
# from fastapi import FastAPI
# from api.v1 import documents, chapters, paragraphs, ai, endpoints, summaries, keywords, templates
# from core.response import generic_exception_handler
# import uvicorn
# import asyncio  # 新增：导入asyncio

# app = FastAPI(title="方案生成系统", version="1.0.0", timeout=300)

# # 注册异常处理器
# app.add_exception_handler(Exception, generic_exception_handler)

# # 注册路由
# app.include_router(documents.router)
# app.include_router(chapters.router)
# app.include_router(paragraphs.router)
# app.include_router(ai.router)
# app.include_router(endpoints.router)
# app.include_router(summaries.router)
# app.include_router(templates.router)

# @app.get("/")
# async def root():
#     return {"message": "Protocol Generation API is running."}

# if __name__ == "__main__":
#     # 修复：改用Config+Server手动启动，避免loop_factory参数冲突
#     config = uvicorn.Config(
#         app=app,
#         host="0.0.0.0",
#         port=8001,
#         loop="asyncio"  # 显式指定loop类型，避免自动传递loop_factory
#     )
#     server = uvicorn.Server(config)
    
#     # 手动运行server，兼容调试模式的asyncio补丁
#     asyncio.run(server.serve())