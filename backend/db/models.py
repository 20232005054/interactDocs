from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, ForeignKey, ARRAY, Boolean
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
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.template_id"), nullable=True)
    title = Column(String(80), nullable=False)
    abstract = Column(Text, nullable=True)  # 正文摘要
    content = Column(JSONB, nullable=True)  # 参考正文
    purpose = Column(String(50), nullable=True)  # 使用目的
    status = Column(String(20), default="draft")
    snapshot_cursor = Column(Integer, default=0)  # 快照计数器
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    chapters = relationship("Chapter", back_populates="document", cascade="all, delete-orphan")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    chat_records = relationship("ChatRecord", back_populates="document", cascade="all, delete-orphan")
    summaries = relationship("DocumentSummary", back_populates="document", cascade="all, delete-orphan")
    keywords = relationship("DocumentKeyword", back_populates="document", cascade="all, delete-orphan")

class Chapter(Base):
    __tablename__ = "chapters"

    chapter_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="SET NULL"), nullable=True, default=None) # 递归父节点
    title = Column(String(200), nullable=False, default="")
    status = Column(String(30), default="editing")
    order_index = Column(Integer, nullable=False, default=0) # 排序索引
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="chapters")
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
    summary_links = relationship("ParagraphSummaryLink", back_populates="paragraph", cascade="all, delete-orphan")
    keyword_links = relationship("KeywordParagraphLink", back_populates="paragraph", cascade="all, delete-orphan")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    version_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id"))
    description = Column(String(255), nullable=False)
    snapshot_data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

    document = relationship("Document", back_populates="versions")

class OperationHistory(Base):
    __tablename__ = "operation_history"
    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id"))
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id"))
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
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    mode = Column(String(20), default="chat")
    created_at = Column(TIMESTAMP, server_default=func.now())

    document = relationship("Document", back_populates="chat_records")
    chapter = relationship("Chapter")

class AIEvaluation(Base):
    __tablename__ = "ai_evaluations"
    evaluation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id"))
    evaluation_result = Column(Text, nullable=False)
    suggestions = Column(ARRAY(Text), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    chapter = relationship("Chapter")


class DocumentSummary(Base):
    __tablename__ = "document_summaries"
    summary_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_change = Column(Integer, nullable=False, default=0)  # 0-无变更，1-有变更
    ai_generate = Column(Text, nullable=True)  # AI生成的内容
    order_index = Column(Integer, nullable=False, default=0)  # 排序索引
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="summaries")
    paragraph_links = relationship("ParagraphSummaryLink", back_populates="summary", cascade="all, delete-orphan")
    keyword_links = relationship("KeywordSummaryLink", back_populates="summary", cascade="all, delete-orphan")
    history = relationship("DocumentSummaryHistory", back_populates="summary", cascade="all, delete-orphan")


class ParagraphSummaryLink(Base):
    __tablename__ = "paragraph_summary_links"
    link_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paragraph_id = Column(UUID(as_uuid=True), ForeignKey("paragraphs.paragraph_id", ondelete="CASCADE"), nullable=False)
    summary_id = Column(UUID(as_uuid=True), ForeignKey("document_summaries.summary_id", ondelete="CASCADE"), nullable=False)
    summary_version = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    paragraph = relationship("Paragraph", back_populates="summary_links")
    summary = relationship("DocumentSummary", back_populates="paragraph_links")


class DocumentKeyword(Base):
    __tablename__ = "document_keywords"
    keyword_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    keyword = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="keywords")
    summary_links = relationship("KeywordSummaryLink", back_populates="keyword", cascade="all, delete-orphan")
    paragraph_links = relationship("KeywordParagraphLink", back_populates="keyword", cascade="all, delete-orphan")
    history = relationship("DocumentKeywordHistory", back_populates="keyword", cascade="all, delete-orphan")


class KeywordSummaryLink(Base):
    __tablename__ = "keyword_summary_links"
    link_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keyword_id = Column(UUID(as_uuid=True), ForeignKey("document_keywords.keyword_id", ondelete="CASCADE"), nullable=False)
    summary_id = Column(UUID(as_uuid=True), ForeignKey("document_summaries.summary_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    keyword = relationship("DocumentKeyword", back_populates="summary_links")
    summary = relationship("DocumentSummary", back_populates="keyword_links")


class KeywordParagraphLink(Base):
    __tablename__ = "keyword_paragraph_links"
    link_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keyword_id = Column(UUID(as_uuid=True), ForeignKey("document_keywords.keyword_id", ondelete="CASCADE"), nullable=False)
    paragraph_id = Column(UUID(as_uuid=True), ForeignKey("paragraphs.paragraph_id", ondelete="CASCADE"), nullable=False)
    keyword_version = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    keyword = relationship("DocumentKeyword", back_populates="paragraph_links")
    paragraph = relationship("Paragraph", back_populates="keyword_links")


class DocumentSummaryHistory(Base):
    __tablename__ = "document_summary_history"
    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    summary_id = Column(UUID(as_uuid=True), ForeignKey("document_summaries.summary_id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    summary = relationship("DocumentSummary", back_populates="history")


class DocumentKeywordHistory(Base):
    __tablename__ = "document_keyword_history"
    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keyword_id = Column(UUID(as_uuid=True), ForeignKey("document_keywords.keyword_id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    keyword = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 关系
    keyword = relationship("DocumentKeyword", back_populates="history")


class Template(Base):
    __tablename__ = "templates"
    template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), nullable=False)  # 逻辑分组ID，同一套模板的不同版本group_id相同
    purpose = Column(String(50), nullable=False)  # 用途大类，用于第一级下拉
    display_name = Column(String(100), nullable=False)  # 具体模板名，用于第二级下拉
    content = Column(JSONB, nullable=False)  # 核心载体，包含提示词模板、结构模板、摘要模板
    version = Column(Integer, nullable=False, default=1)  # 版本号
    is_system = Column(Boolean, nullable=False, default=False)  # 是否为官方系统模板
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)  # 所属用户，系统模板此项为空
    is_active = Column(Boolean, nullable=False, default=True)  # 是否为当前该组模板的生效/推荐版本
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

# 添加Document与Template的关系
Document.template = relationship("Template", backref="documents")