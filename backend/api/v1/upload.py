"""
图片上传接口

POST /api/v1/upload/image
  - 接收 multipart/form-data，字段名 file
  - 支持 jpg/png/gif/webp/svg
  - 最大 10MB
  - 返回 OSS 访问 URL

前端富文本编辑器粘贴图片时，将 Blob 构造成 FormData 调此接口，
拿到 URL 后插入编辑器内容。
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel

from core.response import success_response, ResponseModel
from services.oss_service import upload_image

router = APIRouter(prefix="/api/v1/upload", tags=["文件上传"])

_bearer = HTTPBearer(auto_error=False)  # 只用于让 Swagger 显示锁图标，实际鉴权由 Middleware 处理


class UploadImageResponse(BaseModel):
    url: str


@router.post("/image", summary="上传图片到 OSS", response_model=ResponseModel[UploadImageResponse], dependencies=[Depends(_bearer)])
async def upload_image_api(file: UploadFile = File(...)):
    """
    上传图片，返回 OSS 访问 URL。

    前端富文本编辑器粘贴图片时调用此接口：
    1. 监听 paste 事件，从剪贴板取出 Blob
    2. 构造 FormData，字段名为 file
    3. POST 到此接口，拿到 url
    4. 将 url 插入编辑器（如 <img src="url">）
    """
    content = await file.read()
    try:
        url = await upload_image(
            file_content=content,
            filename=file.filename or "image.png",
            content_type=file.content_type or "image/png",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {e}")

    return success_response(data=UploadImageResponse(url=url))
