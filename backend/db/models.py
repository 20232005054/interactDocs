from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, ForeignKey, ARRAY, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class Document(Base):
    __tablename__ = "documents"
    document_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    template_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(200), nullable=False)
    purpose = Column(String(100), nullable=True)  # 文档用途
    snapshot_cursor = Column(Integer, default=0)  # 快照计数器
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    chapters = relationship("Chapter", back_populates="document", cascade="all, delete-orphan")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    chat_records = relationship("ChatRecord", back_populates="document", cascade="all, delete-orphan")
    summaries = relationship("DocumentSummary", back_populates="document", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    chapter_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False, default="")
    status = Column(Integer, default=0)  # 0-编辑中，1-已完成
    order_index = Column(Integer, nullable=False, default=0) # 排序索引
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="chapters")
    parent = relationship("Chapter", remote_side=[chapter_id], backref="children")
    paragraphs = relationship("Paragraph", back_populates="chapter", cascade="all, delete-orphan")
    operation_history = relationship("OperationHistory", back_populates="chapter", cascade="all, delete-orphan")

class Paragraph(Base):
    __tablename__ = "paragraphs"

    paragraph_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    para_type = Column(String(20), nullable=False)  # 正文、一级标题、二级标题、三级标题、四级标题、五级标题、六级标题
    order_index = Column(Integer, nullable=False)
    ai_eval = Column(Text, nullable=True)
    ai_suggestion = Column(Text, nullable=True)
    ai_generate = Column(Text, nullable=True)
    ischange = Column(Integer, nullable=False, default=0)

    # 关系
    chapter = relationship("Chapter", back_populates="paragraphs")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    version_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"))
    description = Column(String(255), nullable=False)
    snapshot_data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

    document = relationship("Document", back_populates="versions")

class OperationHistory(Base):
    __tablename__ = "operation_history"
    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="CASCADE"))
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    action = Column(String(50), nullable=False)
    content_before = Column(Text, nullable=True)
    content_after = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    chapter = relationship("Chapter", back_populates="operation_history")

class ChatRecord(Base):
    __tablename__ = "chat_records"
    chat_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id"))
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id"), nullable=True)
    chapter_content = Column(JSONB, nullable=True)
    role = Column(String(20), default="user")  # user / assistant
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    mode = Column(String(20), default="chat")
    created_at = Column(TIMESTAMP, server_default=func.now())

    document = relationship("Document", back_populates="chat_records")
    chapter = relationship("Chapter")

class DocumentSummary(Base):
    __tablename__ = "document_summaries"
    summary_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    field_key = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_change = Column(Integer, nullable=False, default=0)  # 0-无变更，1-有变更
    ai_generate = Column(Text, nullable=True)  # AI生成的内容
    order_index = Column(Integer, nullable=False, default=0)  # 排序索引
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="summaries")
    history = relationship("DocumentSummaryHistory", back_populates="summary", cascade="all, delete-orphan")


class DocumentSummaryHistory(Base):
    __tablename__ = "document_summary_history"
    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    summary_id = Column(UUID(as_uuid=True), ForeignKey("document_summaries.summary_id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    field_key = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    summary = relationship("DocumentSummary", back_populates="history")


class DocumentCoreInfo(Base):
    __tablename__ = "document_core_info"
    core_info_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("document_core_info.core_info_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    field_key = Column(String(50), nullable=True)
    content = Column(Text, nullable=False)
    field_type = Column(String(20), default="text")
    options = Column(JSONB, nullable=True)
    is_required = Column(Boolean, default=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_locked = Column(Boolean, nullable=False, default=False)
    is_change = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # 关系
    document = relationship("Document", backref="core_info")
    parent = relationship("DocumentCoreInfo", remote_side=[core_info_id], backref="children")

class Template(Base):
    __tablename__ = "templates"
    template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), nullable=False)
    purpose = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    content = Column(JSONB, nullable=False)
    """
    content字段结构：
    {
        "description": "模板描述",
        "default_prompt": "默认章节生成提示词模板"
    }
    """
    version = Column(Integer, nullable=False, default=1)
    is_system = Column(Boolean, nullable=False, default=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    core_info_templates = relationship("CoreInfoTemplate", back_populates="template", cascade="all, delete-orphan")
    summary_templates = relationship("SummaryTemplate", back_populates="template", cascade="all, delete-orphan")
    structure_templates = relationship("StructureTemplate", back_populates="template", cascade="all, delete-orphan")


class CoreInfoTemplate(Base):
    __tablename__ = "core_info_templates"
    core_template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.template_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("core_info_templates.core_template_id", ondelete="CASCADE"), nullable=True)
    field_name = Column(String(100), nullable=False)
    field_key = Column(String(50), nullable=False)
    field_type = Column(String(20), default="text")
    default_value = Column(Text, nullable=True)
    options = Column(JSONB, nullable=True)
    is_required = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    template = relationship("Template", back_populates="core_info_templates")
    parent = relationship("CoreInfoTemplate", remote_side=[core_template_id], backref="children")


class SummaryTemplate(Base):
    __tablename__ = "summary_templates"
    summary_template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.template_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    field_key = Column(String(50), nullable=False)
    generation_mode = Column(Integer, default=0)
    content_template = Column(Text, nullable=True)
    sources = Column(JSONB, nullable=True)
    """
    sources字段结构(数组):
    [
        {
            "source": {
                "value": "keyinfo", 
                "label": "关键信息",
                "ui_type": "select"
            },
            "match_type": "关键信息匹配", 
            "match_keys": [
                {"value": "trial_name", "label": "试验名称"}
            ],
            "target_field": "trial_name"
        }
    ]
    - source: 来源类型对象，包含 value (keyinfo/summary/chapter), label (显示名), ui_type (组件类型)
    - match_type: 匹配方式描述
    - match_keys: 匹配标识列表（多选），每项包含 value 和 label
    - target_field: 目标字段名，对应content_template中的{{变量名}}
    """
    default_prompt = Column(Text, nullable=True)
    custom_prompt = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    template = relationship("Template", back_populates="summary_templates")


class StructureTemplate(Base):
    __tablename__ = "structure_templates"
    structure_template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.template_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("structure_templates.structure_template_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    field_key = Column(String(50), nullable=False)
    level = Column(Integer, nullable=False)
    generation_mode = Column(Integer, default=0)
    content_template = Column(Text, nullable=True)
    sources = Column(JSONB, nullable=True)
    """
    sources字段结构（数组）：
    [
        {
            "source": {
                "value": "keyinfo", 
                "label": "关键信息",
                "ui_type": "select"
            },
            "match_type": "关键信息匹配", 
            "match_keys": [
                {"value": "trial_name", "label": "试验名称"}
            ],
            "target_field": "trial_name"
        }
    ]
    - source: 来源类型对象，包含 value (keyinfo/summary/chapter), label (显示名), ui_type (组件类型)
    - match_type: 匹配方式描述
    - match_keys: 匹配标识列表（多选），每项包含 value 和 label
    - target_field: 目标字段名，对应content_template中的{{变量名}}
    """
    default_prompt = Column(Text, nullable=True)
    custom_prompt = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    template = relationship("Template", back_populates="structure_templates")
    parent = relationship("StructureTemplate", remote_side=[structure_template_id], backref="children")

# 统一的依赖边表 (构建文档知识图谱的核心)
class DependencyEdge(Base):
    __tablename__ = "dependency_edges"
    
    edge_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)

    # 依赖方 (主体：通常是生成的段落 Paragraph)
    source_type = Column(String(30), nullable=False)  # 例: 'paragraph', 'chapter', 'document'
    source_id = Column(UUID(as_uuid=True), nullable=False)
    
    # 被依赖方 (客体：如 摘要、全局变量、关键词)
    target_type = Column(String(30), nullable=False)  # 例: 'summary', 'document_entity', 'keyword'
    target_id = Column(UUID(as_uuid=True), nullable=False)
    
    # 依赖状态记录 (用于溯源和报警)
    target_version = Column(Integer, nullable=True)   # 生成时依赖的客体版本号
    
    relevance_score = Column(Float, default=1.0)  # 关联权重
    created_at = Column(TIMESTAMP, server_default=func.now())



