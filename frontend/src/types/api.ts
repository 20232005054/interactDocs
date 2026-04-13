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
  is_system: boolean
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

export interface TemplateListParams {
  purpose?: string
  is_system?: boolean
  is_active?: boolean
  keyword?: string
  page?: number
  page_size?: number
}

export interface CreateTemplatePayload {
  purpose: string
  display_name: string
  content: TemplateContent
  is_system?: boolean
}

export interface UpdateTemplatePayload {
  purpose?: string
  display_name?: string
  content?: TemplateContent
  is_system?: boolean
  is_active?: boolean
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
export type GenerationMode = 0 | 1  // 0=复制模式, 1=AI生成

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
export interface StructureTemplate {
  structure_template_id: string
  template_id: string
  parent_id: string | null
  title: string
  field_key: string
  level: number
  generation_mode: GenerationMode
  content_template: string | null
  sources: SourceInfo[] | null
  default_prompt: string | null
  custom_prompt: string | null
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

export interface UpdateCoreInfoPayload {
  title?: string
  content?: string
  parent_id?: string | null
  is_locked?: boolean
  is_change?: number
}
