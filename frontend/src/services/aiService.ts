import { fetchStream } from "@/lib/request"
import request from "@/lib/request"
import type {
  AIChatAction,
  AIChatRequestPayload,
} from "@/types/api"

interface AIChatStreamOptions {
  signal?: AbortSignal
  onChunk?: (chunk: string, accumulated: string) => void
}

interface AIChatStreamResult {
  response: string
  actions?: AIChatAction[]
  suggestions?: any[] // 临时使用 any，后续可以定义具体类型
}

// 聊天历史记录类型
export interface ChatHistoryItem {
  chat_id: string
  document_id: string
  chapter_id: string | null
  role: "user" | "assistant"
  message: string
  response: string | null
  mode: string
  created_at: string
}

export interface ChatHistoryResponse {
  total: number
  page: number
  page_size: number
  items: ChatHistoryItem[]
}

export const aiService = {
  chatStream: async (
    payload: AIChatRequestPayload,
    options: AIChatStreamOptions = {}
  ): Promise<AIChatStreamResult> => {
    const response = await fetchStream("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: options.signal,
    })

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const errorBody = await response.json().catch(() => null)
      const message = errorBody?.message || errorBody?.error || "请求失败，请重试"
      throw new Error(message)
    }

    if (!response.ok || !response.body) {
      throw new Error("请求失败，请重试")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let accumulated = ""
    let finalResponse = ""
    let actions: AIChatAction[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue

        const raw = line.slice(6).trim()
        if (!raw || raw === "[DONE]") continue

        const parsed = JSON.parse(raw) as {
          response?: string
          actions?: AIChatAction[]
          suggestions?: any[]
          error?: string
        }

        if (parsed.error) {
          throw new Error(parsed.error)
        }

        // 如果包含 actions 或 suggestions，说明是最终响应
        if (parsed.actions || parsed.suggestions) {
          finalResponse = parsed.response ?? accumulated
          actions = parsed.actions ?? []
          // 将 suggestions 也返回
          if (parsed.suggestions) {
            return {
              response: finalResponse || accumulated,
              actions,
              suggestions: parsed.suggestions,
            }
          }
          continue
        }

        if (parsed.response) {
          accumulated += parsed.response
          options.onChunk?.(parsed.response, accumulated)
        }
      }
    }

    return {
      response: finalResponse || accumulated,
      actions,
    }
  },

  // 获取聊天历史
  getChatHistory: async (documentId: string, page: number = 1, pageSize: number = 50): Promise<ChatHistoryResponse> => {
    return request<ChatHistoryResponse>(`/api/v1/documents/${documentId}/chat-history?page=${page}&page_size=${pageSize}`)
  },

  // 清空聊天历史
  clearChatHistory: async (documentId: string): Promise<void> => {
    await request(`/api/v1/documents/${documentId}/chat-history`, { method: "DELETE" })
  },
}
