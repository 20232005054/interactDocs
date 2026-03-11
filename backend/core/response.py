from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

T = TypeVar("T")


# 统一响应结构
class ResponseModel(BaseModel, Generic[T]):
    code: int = 200
    message: str = "成功"
    data: Optional[T] = None


def success_response(data: Any = None, message: str = "成功") -> JSONResponse:
    response_data = ResponseModel(code=200, message=message, data=data)
    return JSONResponse(
        status_code=200,
        content=jsonable_encoder(response_data)
    )


# 全局异常处理
async def generic_exception_handler(request: Request, exc: Exception):
    status_code = 500
    if isinstance(exc, HTTPException):
        status_code = exc.status_code

    return JSONResponse(
        status_code=status_code,
        content={
            "code": status_code,
            "message": str(exc.detail) if hasattr(exc, "detail") else "服务器内部错误",
            "data": None
        }
    )