import request, { fetchStream } from "@/lib/request"
import type {
  Paragraph,
  ParagraphListResponse,
  CreateParagraphPayload,
  UpdateParagraphPayload,
  LiteratureListResponse,
} from "@/types/api"

export interface EvaluateAIResult {
  evaluation: string
  suggestions: string[]
}

export interface EvaluateAIStreamOptions {
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  onResult?: (result: EvaluateAIResult) => void
}

export const paragraphService = {
  getByChapter: (chapterId: string): Promise<ParagraphListResponse> =>
    request.get(`/api/v1/chapters/${chapterId}/paragraphs`),

  get: (paragraphId: string): Promise<Paragraph> =>
    request.get(`/api/v1/paragraphs/${paragraphId}`),

  create: (chapterId: string, payload: CreateParagraphPayload): Promise<Paragraph> =>
    request.post(`/api/v1/chapters/${chapterId}/paragraphs`, payload),

  insertAfter: (paragraphId: string, payload: CreateParagraphPayload): Promise<Paragraph> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/insert-after`, payload),

  update: (paragraphId: string, payload: UpdateParagraphPayload): Promise<Paragraph> =>
    request.put(`/api/v1/paragraphs/${paragraphId}`, payload),

  delete: (paragraphId: string): Promise<void> =>
    request.delete(`/api/v1/paragraphs/${paragraphId}`),

  applyAI: (paragraphId: string): Promise<Paragraph> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/ai/apply`),

  // AI 评估：SSE 流式，使用 fetchStream 统一注入 token
  evaluateAI: async (paragraphId: string, options: EvaluateAIStreamOptions = {}): Promise<void> => {
    const res = await fetchStream(`/api/v1/paragraphs/${paragraphId}/ai/evaluate`, {
      method: "POST",
      signal: options.signal,
    })

    if (!res.ok || !res.body) throw new Error("请求失败")

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

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
        try {
          const parsed = JSON.parse(raw) as {
            content?: string
            evaluation?: string
            suggestions?: string[]
          }
          if (parsed.content) options.onChunk?.(parsed.content)
          if (parsed.evaluation !== undefined) {
            options.onResult?.({
              evaluation: parsed.evaluation,
              suggestions: parsed.suggestions ?? [],
            })
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  },

  // AI 帮填：SSE 流式，使用 fetchStream 统一注入 token
  assistAI: async (
    paragraphId: string,
    instruction: string | undefined,
    options: { signal?: AbortSignal; onChunk?: (chunk: string) => void } = {}
  ): Promise<void> => {
    const res = await fetchStream(`/api/v1/paragraphs/${paragraphId}/ai/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: instruction?.trim() || undefined }),
      signal: options.signal,
    })

    if (!res.ok || !res.body) throw new Error("请求失败")

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

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
        try {
          const parsed = JSON.parse(raw) as { error?: string; content?: string }
          if (parsed.error) throw new Error(String(parsed.error))
          if (parsed.content) options.onChunk?.(parsed.content)
        } catch (err) {
          // 重新抛出业务错误，忽略 JSON 解析错误
          if (err instanceof Error && err.message !== "JSON parse error") throw err
        }
      }
    }
  },

  // 查询段落绑定的文献
  listLiterature: (paragraphId: string): Promise<LiteratureListResponse> =>
    request.get(`/api/v1/paragraphs/${paragraphId}/literature`),

  // 确认段落变更
  confirmChange: (paragraphId: string): Promise<Paragraph> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/confirm-change`),
}
