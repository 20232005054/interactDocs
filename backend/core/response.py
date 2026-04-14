from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

T = TypeVar("T")


# 统一响应结构
class ResponseModel(BaseModel, Generic[T]):
    code: int = 200
    message: str = "成功"
    data: Optional[T] = None


def success_response(data: Any = None, message: str = "成功") -> dict:
    return {"code": 200, "message": message, "data": data}


def _error_response(code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content={"code": code, "message": message, "data": None}
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    return _error_response(exc.status_code, str(exc.detail))


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for e in errors:
        loc = " -> ".join(str(x) for x in e["loc"] if x != "body")
        messages.append(f"{loc}: {e['msg']}" if loc else e["msg"])
    return _error_response(422, "请求参数错误: " + "; ".join(messages))


async def generic_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, ValueError):
        return _error_response(400, str(exc))
    return _error_response(500, "服务器内部错误")