from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, ForeignKey, ARRAY, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
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
    core_info = relationship("DocumentCoreInfo", back_populates="document", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    chapter_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False, default="")
    field_key = Column(String(50), nullable=True)
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
    para_def_idx = Column(Integer, nullable=True)   # 对应 StructureTemplate.paragraphs 的下标，应用模板时写入，用户手动创建的段落为 null
    ai_eval = Column(Text, nullable=True)
    ai_suggestion = Column(Text, nullable=True)
    ai_generate = Column(Text, nullable=True)
    ai_instruction = Column(Text, nullable=True)  # 暂存用户对本次AI生成结果的修改意见，apply时反哺模板后清空；与 ai_generate 严格配对
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
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"))
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.chapter_id", ondelete="SET NULL"), nullable=True)
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
    is_change = Column(Integer, nullable=False, default=0)  # 0=无变更 1=有变更(待处理) 2=已联动更新(核心信息/摘要变更触发) 3=下游段落变更后AI重新生成(待用户确认)
    ai_generate = Column(Text, nullable=True)  # AI生成的内容
    order_index = Column(Integer, nullable=False, default=0)  # 排序索引
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="summaries")


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
    document = relationship("Document", back_populates="core_info")
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
        "description": "模板说明文字"
    }
    """
    version = Column(Integer, nullable=False, default=1)
    # template_type: 0=文档私有副本, 1=系统模板, 2=用户可复用私有模板, 3=用户公开分享(未实现)
    template_type = Column(Integer, nullable=False, default=0)
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
                "label": "关键信息"
            },
            "match_type": "关键信息匹配", 
            "match_keys": [
                {"value": "trial_name", "label": "试验名称"}
            ]
        }
    ]
    - source: 来源类型对象，包含 value (keyinfo/summary/chapter), label (显示名)
    - match_type: 匹配方式描述
    - match_keys: 匹配标识列表（多选），每项包含 value 和 label
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
    order_index = Column(Integer, default=0)
    paragraphs = Column(JSONB, nullable=True)
    # 段落定义数组，每项结构：
    # {
    #   "para_type": "paragraph"|"heading1"|"heading2"|"heading3",
    #   "content_template": "...",   # mode=0/2/3 时使用，可含 {{变量}}
    #   "generation_mode": 0|1|2|3,
    #   "sources": [...] | null,     # mode=0/1/3 时配置来源
    #   "default_prompt": "..." | null,
    #   "custom_prompt": "..." | null
    # }
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
    source_type = Column(String(30), nullable=False)  # 'paragraph', 'chapter', 'summary'
    source_id = Column(UUID(as_uuid=True), nullable=False)
    
    # 被依赖方 (客体：如 摘要、核心信息、章节)
    target_type = Column(String(30), nullable=False)  # 'core_info', 'summary', 'chapter'
    target_id = Column(UUID(as_uuid=True), nullable=False)
    
    # 依赖状态记录 (用于溯源和报警)
    target_version = Column(Integer, nullable=True)   # 生成时依赖的客体版本号
    
    relevance_score = Column(Float, default=1.0)  # 关联权重
    created_at = Column(TIMESTAMP, server_default=func.now())





class Literature(Base):
    """文献主表，独立存在，通过 TemplateLiterature 关联表绑定到模板"""
    __tablename__ = "literature"

    literature_id   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    literature_key  = Column(String(20), nullable=False, unique=True)
    # literature_key: 系统生成的业务标识符，格式 lit_xxxxxxxx，用于跨系统导入导出匹配
    title           = Column(String(500), nullable=True)
    authors         = Column(Text, nullable=True)
    journal         = Column(String(200), nullable=True)
    publish_date    = Column(TIMESTAMP, nullable=True)
    doi             = Column(String(100), nullable=True)
    impact_factor   = Column(Float, nullable=True)
    source_file     = Column(String(500), nullable=True)   # OSS 文件路径
    upload_status   = Column(String(20), nullable=False, default="pending")
    # upload_status: pending / processing / ready / failed
    error_message   = Column(Text, nullable=True)
    scope           = Column(String(20), nullable=False, default="private")
    # scope: 'public'=admin/editor 维护的公共文献, 'private'=用户私有文献
    processing_mode = Column(String(20), nullable=False, default="fast")
    # processing_mode: 'fast'=快速模式（仅摘要，3秒）, 'full'=完整模式（全文分块，30-60秒）
    chunk_count     = Column(Integer, nullable=False, default=0)
    # chunk_count: 分块数量，fast模式=1，full模式=N
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    created_at      = Column(TIMESTAMP, server_default=func.now())

    chunks          = relationship("LiteratureChunk", back_populates="literature", cascade="all, delete-orphan")
    citations       = relationship("DocumentCitation", back_populates="literature", cascade="all, delete-orphan")
    template_links  = relationship("TemplateLiterature", back_populates="literature", cascade="all, delete-orphan")
    paragraph_links = relationship("ParagraphLiterature", back_populates="literature", cascade="all, delete-orphan")


class TemplateLiterature(Base):
    """模板-文献关联表（多对多），文献可复用到多个模板"""
    __tablename__ = "template_literature"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id     = Column(UUID(as_uuid=True), ForeignKey("templates.template_id", ondelete="CASCADE"), nullable=False)
    literature_id   = Column(UUID(as_uuid=True), ForeignKey("literature.literature_id", ondelete="CASCADE"), nullable=False)
    created_at      = Column(TIMESTAMP, server_default=func.now())

    literature      = relationship("Literature", back_populates="template_links")


class LiteratureChunk(Base):
    """文献分块向量表"""
    __tablename__ = "literature_chunks"

    chunk_id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    literature_id   = Column(UUID(as_uuid=True), ForeignKey("literature.literature_id", ondelete="CASCADE"), nullable=False)
    section_type    = Column(String(30), nullable=True)
    # section_type: abstract / intro / method / result / conclusion / other
    content         = Column(Text, nullable=False)
    embedding       = Column(Text, nullable=True)   # 存储时用 pgvector vector 类型，ORM 层用 Text 占位，实际 DDL 见 SQL
    chunk_index     = Column(Integer, nullable=False)
    created_at      = Column(TIMESTAMP, server_default=func.now())

    literature      = relationship("Literature", back_populates="chunks")


class DocumentCitation(Base):
    """文档引用关联表，记录段落/摘要引用了哪篇文献"""
    __tablename__ = "document_citations"

    citation_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id     = Column(UUID(as_uuid=True), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False)
    source_type     = Column(String(20), nullable=False)   # paragraph / summary
    source_id       = Column(UUID(as_uuid=True), nullable=False)
    literature_id   = Column(UUID(as_uuid=True), ForeignKey("literature.literature_id", ondelete="CASCADE"), nullable=False)
    citation_number = Column(Integer, nullable=False)      # [1][2] 里的编号
    created_at      = Column(TIMESTAMP, server_default=func.now())

    literature      = relationship("Literature", back_populates="citations")


class ParagraphLiterature(Base):
    """段落-文献关联表（多对多），支持段落级精准文献引用"""
    __tablename__ = "paragraph_literature"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paragraph_id    = Column(UUID(as_uuid=True), ForeignKey("paragraphs.paragraph_id", ondelete="CASCADE"), nullable=False)
    literature_id   = Column(UUID(as_uuid=True), ForeignKey("literature.literature_id", ondelete="CASCADE"), nullable=False)
    created_at      = Column(TIMESTAMP, server_default=func.now())

    # 关系
    literature      = relationship("Literature", back_populates="paragraph_links")
