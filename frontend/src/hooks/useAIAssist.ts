"use client"

import { useCallback } from "react"
import { paragraphService } from "@/services/paragraphService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore } from "@/store/editorStore"

export function useAIAssist() {
  const { updateParagraph } = useDocumentStore()
  const {
    setAiAssistingParagraphId,
    appendAiAssistPreview,
    clearAiAssistPreview,
    aiAssistingParagraphId,
    aiAssistPreview,
  } = useEditorStore()

  const startAssist = useCallback(async (paragraphId: string, chapterId: string, instruction?: string) => {
    if (aiAssistingParagraphId) return // 已有进行中的帮填

    setAiAssistingParagraphId(paragraphId)
    clearAiAssistPreview()

    try {
      await paragraphService.assistAI(paragraphId, instruction, {
        onChunk: (chunk) => appendAiAssistPreview(chunk),
      })
    } catch (err) {
      clearAiAssistPreview()
      setAiAssistingParagraphId(null)
      throw err
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
