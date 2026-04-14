"use client"

import { useEffect, useRef, useCallback } from "react"
import { summaryService } from "@/services/summaryService"
import { paragraphService } from "@/services/paragraphService"
import { useDocumentStore } from "@/store/documentStore"

interface SSEEvent {
  type: "summary_updated" | "paragraph_updated" | "ping"
  summary_id?: string
  chapter_id?: string
  paragraph_id?: string
}

interface UseDocumentSSEOptions {
  documentId: string
  enabled?: boolean
}

export function useDocumentSSE({ documentId, enabled = true }: UseDocumentSSEOptions) {
  const { updateSummary, updateParagraph } = useDocumentStore()
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)

  const handleEvent = useCallback(async (event: SSEEvent) => {
    if (event.type === "ping") return

    if (event.type === "summary_updated" && event.summary_id) {
      try {
        const updated = await summaryService.get(event.summary_id)
        updateSummary(updated.summary_id, updated)
      } catch {
        // 静默失败
      }
    }

    if (event.type === "paragraph_updated" && event.chapter_id && event.paragraph_id) {
      try {
        const updated = await paragraphService.get(event.paragraph_id)
        updateParagraph(event.chapter_id, updated.paragraph_id, updated.content)
      } catch {
        // 静默失败
      }
    }
  }, [updateSummary, updateParagraph])

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return

    const abort = new AbortController()
    abortRef.current = abort

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    fetch(`/api/v1/documents/${documentId}/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: abort.signal,
    })
      .then(async res => {
        if (!res.ok || !res.body) throw new Error(`SSE 连接失败: ${res.status}`)

        retryCountRef.current = 0
        const reader = res.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ""

        try {
          while (mountedRef.current) {
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
                const event: SSEEvent = JSON.parse(raw)
                handleEvent(event)
              } catch {
                // 忽略解析错误
              }
            }
          }
        } catch (err: unknown) {
          // 主动 abort 触发的 AbortError 静默忽略，不往上抛
          if ((err as Error)?.name === "AbortError") return
          throw err
        }
      })
      .catch(err => {
        if (!mountedRef.current) return
        if (err?.name === "AbortError") return

        // 指数退避重连，最大 30s
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect()
        }, delay)
      })
  }, [documentId, enabled, handleEvent])

  useEffect(() => {
    mountedRef.current = true
    if (enabled) connect()

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      readerRef.current?.cancel().catch(() => {})
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [connect, enabled])
}
