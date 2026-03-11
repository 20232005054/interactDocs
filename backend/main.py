from fastapi import FastAPI
from api.v1 import documents, chapters, ai, endpoints, summaries, keywords, templates
from core.response import generic_exception_handler
import uvicorn

app = FastAPI(title="方案生成系统", version="1.0.0",timeout=300)

# 注册异常处理器
app.add_exception_handler(Exception, generic_exception_handler)

# 注册路由
app.include_router(documents.router)
app.include_router(chapters.router)
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