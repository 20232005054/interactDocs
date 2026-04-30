// ============================================================
// 通用响应结构
// ============================================================
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ============================================================
// 用户 / 认证
// ============================================================
export type UserRole = "user" | "editor" | "admin"

export interface User {
  user_id: string
  email: string
  name: string
  role: UserRole
}

export interface Token {
  access_token: string
  token_type: string
  user_id: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
}

// ============================================================
// 文档
// ============================================================
export interface DocumentListItem {
  document_id: string
  title: string
  purpose: string | null
  template_purpose: string | null
  template_name: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
  updated_at: string
}

export interface DocumentDetail extends DocumentListItem {
  template_id: string | null
  template_name: string | null
}

export interface DocumentListResponse {
  page: number
  page_size: number
  total: number
  items: DocumentListItem[]
}

export interface DocumentSnapshot {
  version_id: string
  document_id: string
  description: string
  snapshot_data: Record<string, unknown>
  created_at: string
  created_by: string | null
}

export interface DocumentSnapshotListResponse {
  snapshots: DocumentSnapshot[]
}

export type DocumentExportFormat = "docx" | "pdf" | "md"

export interface CreateDocumentPayload {
  title: string
  purpose: string
  template_id: string
}

export interface UpdateDocumentPayload {
  title?: string
  purpose?: string
  template_id?: string
}

// ============================================================
// 管理员统计
// ============================================================
export interface StatsOverview {
  total_users: number
  total_documents: number
  total_templates: number
}

// ============================================================
// 管理员用户列表
// ============================================================
export interface AdminUserListResponse {
  total: number
  items: User[]
}

// ============================================================
// 模板主表
// ============================================================
export interface TemplateContent {
  [key: string]: unknown
  description?: string
  default_prompt?: string
}

export interface Template {
  template_id: string
  group_id: string
  purpose: string
  display_name: string
  content: TemplateContent
  version: number
  /** 0=文档私有副本 1=系统模板 2=用户可复用私有模板 3=用户公开分享(未实现) */
  template_type: number
  user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TemplateDetail extends Template {
  document_id: string | null
}

export interface TemplateListResponse {
  page: number
  page_size: number
  total: number
  items: Template[]
}

export interface TemplateSimpleListResponse {
  items: Template[]
}

export interface TemplateListParams {
  purpose?: string
  template_type?: number
  is_active?: boolean
  keyword?: string
  include_user?: boolean
  page?: number
  page_size?: number
}

export interface CreateTemplatePayload {
  purpose: string
  display_name: string
  content: TemplateContent
  template_type?: number
}

export interface UpdateTemplatePayload {
  purpose?: string
  display_name?: string
  content?: TemplateContent
  template_type?: number
  is_active?: boolean
}

export interface TemplateDependencyRef {
  type: string
  field_key: string
  label: string
}

export interface CoreInfoDependencyItem {
  field_key: string
  field_name: string
  referenced_by: TemplateDependencyRef[]
}

export interface SummaryDependencyItem {
  field_key: string
  title: string
  references: TemplateDependencyRef[]
  referenced_by: TemplateDependencyRef[]
}

export interface StructureDependencyItem {
  field_key: string
  title: string
  references: TemplateDependencyRef[]
}

export interface TemplateDependenciesResponse {
  core_info_templates: CoreInfoDependencyItem[]
  summary_templates: SummaryDependencyItem[]
  structure_templates: StructureDependencyItem[]
}

// ============================================================
// 核心信息模板
// ============================================================
export type FieldType = "text" | "select" | "group"

export interface CoreInfoTemplate {
  core_template_id: string
  template_id: string
  parent_id: string | null
  field_name: string
  field_key: string
  field_type: FieldType
  default_value: string | null
  options: string[] | null
  is_required: boolean
  order_index: number
  created_at: string
  updated_at: string
  children?: CoreInfoTemplate[]
}

export interface CoreInfoTemplateListResponse {
  items: CoreInfoTemplate[]
}

export interface CreateCoreInfoTemplatePayload {
  template_id: string
  parent_id?: string | null
  field_name: string
  field_type?: FieldType
  default_value?: string | null
  options?: string[] | null
  is_required?: boolean
  order_index?: number | null
}

export interface UpdateCoreInfoTemplatePayload {
  field_name?: string
  field_key?: string
  field_type?: FieldType
  default_value?: string | null
  options?: string[] | null
  is_required?: boolean
  order_index?: number
}

export interface CoreInfoTemplateReorderPayload {
  parent_id: string | null
  ordered_ids: string[]
}

// ============================================================
// 摘要模板
// ============================================================
export type GenerationMode = 0 | 1 | 2 | 3  // 0=复制, 1=AI生成, 2=直接使用, 3=AI修改

export interface SourceMatchKey {
  value: string
  label: string
  ui_type?: string
}

export interface SourceInfo {
  source: SourceMatchKey
  match_type: string
  match_keys: SourceMatchKey[]
  target_field: string
}

export interface TemplateInfoResponse {
  template_id: string
  core_info_templates: CoreInfoTemplate[]
  summary_templates: SummaryTemplate[]
  structure_templates: StructureTemplate[]
}

export interface SummaryTemplate {
  summary_template_id: string
  template_id: string
  title: string
  field_key: string
  generation_mode: GenerationMode
  content_template: string | null
  sources: SourceInfo[] | null
  default_prompt: string | null
  custom_prompt: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface SummaryTemplateListResponse {
  items: SummaryTemplate[]
}

export interface CreateSummaryTemplatePayload {
  template_id: string
  title: string
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
  order_index?: number | null
}

export interface UpdateSummaryTemplatePayload {
  title?: string
  field_key?: string
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
  order_index?: number
}

// ============================================================
// 章节结构模板
// ============================================================
export interface StructureTemplateParagraphDef {
  para_type?: ParaType
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
}

export interface StructureTemplate {
  structure_template_id: string
  template_id: string
  parent_id: string | null
  title: string
  field_key: string
  level: number
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
  paragraphs?: StructureTemplateParagraphDef[] | null
  order_index: number
  created_at: string
  updated_at: string
  children?: StructureTemplate[]
}

export interface StructureTemplateTreeResponse {
  tree: StructureTemplate[]
}

export interface StructureTemplateListResponse {
  items: StructureTemplate[]
}

export interface CreateStructureTemplatePayload {
  template_id: string
  parent_id?: string | null
  title: string
  level: number
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
  paragraphs?: StructureTemplateParagraphDef[] | null
  order_index?: number | null
}

export interface UpdateStructureTemplatePayload {
  parent_id?: string | null
  title?: string
  field_key?: string
  level?: number
  generation_mode?: GenerationMode
  content_template?: string | null
  sources?: SourceInfo[] | null
  default_prompt?: string | null
  custom_prompt?: string | null
  paragraphs?: StructureTemplateParagraphDef[] | null
  order_index?: number
}

export interface StructureTemplateReorderPayload {
  parent_id: string | null
  ordered_ids: string[]
}

// ============================================================
// 段落
// ============================================================
export type ParaType = "paragraph" | "heading1" | "heading2" | "heading3"

export interface Paragraph {
  paragraph_id: string
  chapter_id: string
  content: string
  para_type: ParaType
  order_index: number
  ai_eval: string | null
  ai_suggestion: string | null
  ai_generate: string | null
  ischange: number
}

export interface ParagraphListResponse {
  paragraphs: Paragraph[]
}

export interface CreateParagraphPayload {
  content: string
  para_type?: ParaType
}

export interface UpdateParagraphPayload {
  content?: string
  para_type?: ParaType
  order_index?: number
  ai_eval?: string | null
  ai_suggestion?: string | null
  ai_generate?: string | null
  ischange?: number
}

// ============================================================
// 章节
// ============================================================
export interface Chapter {
  chapter_id: string
  document_id: string
  parent_id: string | null
  title: string
  field_key: string | null
  status: number
  order_index: number
  updated_at: string
  paragraphs?: Paragraph[]
}

export interface ChapterTreeNode extends Chapter {
  children: ChapterTreeNode[]
  paragraphs: Paragraph[]
}

export interface ChapterTreeResponse {
  tree: ChapterTreeNode[]
}

export interface FullContentResponse {
  document_id: string
  tree: ChapterTreeNode[]
}

export interface UpdateChapterPayload {
  title?: string
  status?: number
  parent_id?: string | null
}

// ============================================================
// 摘要（文档实例）
// ============================================================
export interface Summary {
  summary_id: string
  document_id: string
  title: string
  field_key: string
  content: string
  is_change: number
  version: number
  order_index: number
  created_at: string
  updated_at: string
}

export interface SummaryListResponse {
  summaries: Summary[]
}

export interface UpdateSummaryPayload {
  title?: string
  field_key?: string
  content?: string
}

// ============================================================
// AI 对话
// ============================================================
export interface AIChatSelectedParagraph {
  paragraph_id: string
  content: string
  para_type?: ParaType
}

export interface AIChatSelectedSummary {
  summary_id: string
  title: string
  content: string
}

export interface AIChatRequestPayload {
  message: string
  document_id: string
  current_chapter_id?: string
  selected_paragraphs?: AIChatSelectedParagraph[]
  selected_summaries?: AIChatSelectedSummary[]
}

export interface AIChatAction {
  type: string
  target_type?: string
  target_id?: string
  suggested_content?: string
  [key: string]: unknown
}

// ============================================================
// 核心信息（文档实例）
// ============================================================
export interface CoreInfo {
  core_info_id: string
  document_id: string
  parent_id: string | null
  title: string
  field_key: string | null
  content: string
  field_type: string
  options: string[] | null
  is_required: boolean
  order_index: number
  is_locked: boolean
  is_change: number
  created_at: string
  updated_at: string
  children: CoreInfo[]
}

export interface CoreInfoTreeResponse {
  items: CoreInfo[]
}

export interface CreateCoreInfoPayload {
  title: string
  content?: string
  field_type?: string
  options?: string[] | null
  is_required?: boolean
  parent_id?: string | null
  order_index?: number | null
  is_locked?: boolean
}

export interface UpdateCoreInfoPayload {
  title?: string
  content?: string
  parent_id?: string | null
  is_locked?: boolean
  is_change?: number
}

// ============================================================
// 文献
// ============================================================
export type LiteratureUploadStatus = "pending" | "processing" | "ready" | "failed"
export type LiteratureScope = "public" | "private"
export type LiteratureProcessingMode = "fast" | "full"

export interface Literature {
  literature_id: string
  literature_key: string
  title: string | null
  authors: string | null
  journal: string | null
  publish_date: string | null
  doi: string | null
  impact_factor: number | null
  source_file: string | null
  upload_status: LiteratureUploadStatus
  error_message: string | null
  scope: LiteratureScope
  processing_mode: LiteratureProcessingMode
  chunk_count: number
  user_id: string | null
  user_name: string | null
  created_at: string
}

export interface LiteratureListResponse {
  items: Literature[]
  total: number
}

export interface UploadLiteraturePayload {
  file: File
  title?: string
  authors?: string
  journal?: string
  doi?: string
  impact_factor?: number
}

export interface UpdateLiteraturePayload {
  title?: string
  authors?: string
  journal?: string
  doi?: string
  impact_factor?: number
}

export interface ParagraphLiteratureUploadPayload {
  file: File
  title?: string
  authors?: string
  journal?: string
  doi?: string
  impact_factor?: number
}

// ============================================================
// 文献引用（文档实例）
// ============================================================
export interface DocumentCitationItem {
  citation_number: number
  literature_id: string
  title: string | null
  authors: string | null
  journal: string | null
  publish_date: string | null
  doi: string | null
  impact_factor: number | null
}

export interface DocumentCitationsResponse {
  citations: DocumentCitationItem[]
  total: number
}

// ============================================================
// 段落文献绑定关系
// ============================================================
export interface ParagraphLiteratureItem {
  paragraph_id: string
  chapter_id: string
  chapter_title: string
  paragraph_content: string
  paragraph_order: number
  literature_id: string
  literature_title: string | null
  literature_authors: string | null
  literature_journal: string | null
  literature_doi: string | null
}

export interface ParagraphLiteratureResponse {
  items: ParagraphLiteratureItem[]
  total: number
}
