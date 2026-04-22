"""用户认证相关 schema"""
from pydantic import BaseModel, Field, EmailStr
from uuid import UUID


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    name: str = Field(..., description="姓名")
    password: str = Field(..., description="密码")


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., description="密码")


class UserUpdate(BaseModel):
    name: str | None = Field(None, description="姓名")


class UserPasswordUpdate(BaseModel):
    old_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=6, description="新密码，至少6位")


class User(BaseModel):
    user_id: UUID
    email: EmailStr
    name: str
    role: str = Field(..., description="用户角色")

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(..., description="令牌类型")
    user_id: UUID = Field(..., description="用户 ID")
