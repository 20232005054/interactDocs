import { fetchStream } from "@/lib/request"
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
  actions: AIChatAction[]
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
          error?: string
        }

        if (parsed.error) {
          throw new Error(parsed.error)
        }

        if (parsed.actions) {
          finalResponse = parsed.response ?? accumulated
          actions = parsed.actions
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
}
