/**
 * AI 建议类型定义
 */

// 建议状态
export type SuggestionStatus = "pending" | "applied" | "rejected"

// 基础建议接口
interface BaseSuggestion {
  id: string // 前端生成的唯一标识
  status: SuggestionStatus
}

// 创建章节建议
export interface CreateChapterSuggestion extends BaseSuggestion {
  type: "create_chapter"
  title: string
  parent_id: string | null
  description?: string
}

// 创建段落建议
export interface CreateParagraphSuggestion extends BaseSuggestion {
  type: "create_paragraph"
  chapter_id: string
  para_type: "paragraph" | "heading1" | "heading2" | "heading3"
  content: string
  description?: string
}

// 修改内容建议
export interface EditContentSuggestion extends BaseSuggestion {
  type: "edit_content"
  target_type: "paragraph" | "summary"
  target_id: string
  original_content: string
  suggested_content: string
  reason?: string
}

// 插入文本建议
export interface InsertTextSuggestion extends BaseSuggestion {
  type: "insert_text"
  chapter_id: string
  content: string
  position: "start" | "end"
  description?: string
}

// 联合类型
export type AISuggestion =
  | CreateChapterSuggestion
  | CreateParagraphSuggestion
  | EditContentSuggestion
  | InsertTextSuggestion

// 从后端接收的原始建议（没有 id 和 status）
export type RawSuggestion = Omit<AISuggestion, "id" | "status">

// 建议应用结果
export interface SuggestionResult {
  success: boolean
  error?: string
  data?: any
}
