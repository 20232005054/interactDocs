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


class TemplateType(int, Enum):
    """模板类型枚举
    - DOCUMENT_PRIVATE: 文档私有副本（绑定 document_id，不可复用）
    - SYSTEM: 系统模板（editor/admin 维护，所有人可用）
    - USER_REUSABLE: 用户导出的可复用私有模板（创建文档时可选）
    - USER_PUBLIC: 用户公开分享模板（预留，未实现）
    """
    DOCUMENT_PRIVATE = 0
    SYSTEM = 1
    USER_REUSABLE = 2
    USER_PUBLIC = 3




class EdgeSourceType(str, Enum):
    PARAGRAPH = "paragraph"
    CHAPTER = "chapter"
    SUMMARY = "summary"


class EdgeTargetType(str, Enum):
    CORE_INFO = "core_info"
    SUMMARY   = "summary"
    CHAPTER   = "chapter"


class ChapterStatus(int, Enum):
    """章节状态：0=编辑中，1=已完成"""
    EDITING = 0
    DONE = 1


class ParaType(str, Enum):
    """段落类型"""
    PARAGRAPH = "paragraph"
    HEADING_1 = "heading-1"
    HEADING_2 = "heading-2"
    HEADING_3 = "heading-3"
    HEADING_4 = "heading-4"
    HEADING_5 = "heading-5"
    HEADING_6 = "heading-6"