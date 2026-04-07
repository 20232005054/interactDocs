from enum import Enum


class UserRole(str, Enum):
    """用户角色枚举
    - USER: 普通用户，只能操作自己的文档
    - EDITOR: 专业医生/编辑，额外可以编辑系统模板
    - ADMIN: 管理员，全部权限
    """
    USER = "user"
    EDITOR = "editor"
    ADMIN = "admin"


class EdgeSourceType:
    PARAGRAPH = "paragraph"
    CHAPTER = "chapter"
    SUMMARY = "summary"


class EdgeTargetType:
    CORE_INFO = "core_info"   # 原 document_entity，指向 DocumentCoreInfo
    SUMMARY   = "summary"
    CHAPTER   = "chapter"
    KEYWORD   = "keyword"
