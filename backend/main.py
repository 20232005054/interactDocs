from fastapi import FastAPI
from api.v1 import documents, chapters, paragraphs, ai, endpoints, summaries, keywords, templates
from core.response import generic_exception_handler
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="方案生成系统", version="1.0.0",timeout=300)

# 注册异常处理器
app.add_exception_handler(Exception, generic_exception_handler)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# 注册路由
app.include_router(documents.router)
app.include_router(chapters.router)
app.include_router(paragraphs.router)
app.include_router(ai.router)
app.include_router(endpoints.router)
app.include_router(summaries.router)
app.include_router(keywords.router)
app.include_router(templates.router)

@app.get("/")
async def root():
    return {"message": "Protocol Generation API is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
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
# app.include_router(keywords.router)
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