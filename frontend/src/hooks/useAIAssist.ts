"use client"

import { useCallback } from "react"
import { paragraphService } from "@/services/paragraphService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore } from "@/store/editorStore"

export function useAIAssist() {
  const { updateParagraph } = useDocumentStore()
  const {
    setAiAssistingParagraphId,
    setAiAssistPreview,
    appendAiAssistPreview,
    clearAiAssistPreview,
    aiAssistingParagraphId,
    aiAssistPreview,
  } = useEditorStore()

  const startAssist = useCallback(async (paragraphId: string, chapterId: string) => {
    if (aiAssistingParagraphId) return // 已有进行中的帮填

    setAiAssistingParagraphId(paragraphId)
    clearAiAssistPreview()

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    try {
      const res = await fetch(`/api/v1/paragraphs/${paragraphId}/ai/assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
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
            const parsed = JSON.parse(raw)
            if (parsed.content) appendAiAssistPreview(parsed.content)
          } catch {
            // 忽略
          }
        }
      }
    } catch {
      clearAiAssistPreview()
      setAiAssistingParagraphId(null)
    }
  }, [aiAssistingParagraphId, setAiAssistingParagraphId, clearAiAssistPreview, appendAiAssistPreview])

  const applyAssist = useCallback(async (paragraphId: string, chapterId: string) => {
    try {
      const updated = await paragraphService.applyAI(paragraphId)
      updateParagraph(chapterId, paragraphId, updated.content)
    } finally {
      setAiAssistingParagraphId(null)
      clearAiAssistPreview()
    }
  }, [updateParagraph, setAiAssistingParagraphId, clearAiAssistPreview])

  const discardAssist = useCallback(() => {
    setAiAssistingParagraphId(null)
    clearAiAssistPreview()
  }, [setAiAssistingParagraphId, clearAiAssistPreview])

  return {
    aiAssistingParagraphId,
    aiAssistPreview,
    startAssist,
    applyAssist,
    discardAssist,
  }
}
