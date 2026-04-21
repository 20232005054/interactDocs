"use client"

import { create } from "zustand"
import type {
  AIChatSelectedParagraph,
  AIChatSelectedSummary,
  ParaType,
} from "@/types/api"

export interface ChatParagraphContext extends AIChatSelectedParagraph {
  context_id: string
  kind: "paragraph"
  source: "manual" | "selection"
  chapter_id: string
  chapter_title: string | null
  selected_text?: string
}

export interface ChatSummaryContext extends AIChatSelectedSummary {
  context_id: string
  kind: "summary"
  source: "manual"
}

export type ChatContextItem = ChatParagraphContext | ChatSummaryContext

interface ParagraphContextInput {
  paragraph_id: string
  chapter_id: string
  chapter_title?: string | null
  content: string
  para_type?: ParaType
  selected_text?: string
}

interface ChatStore {
  contextItems: ChatContextItem[]
  upsertManualParagraphContext: (input: ParagraphContextInput, options?: { moveToEnd?: boolean }) => void
  upsertSelectionParagraphContext: (input: ParagraphContextInput) => void
  updateParagraphContextContent: (paragraphId: string, content: string) => void
  removeContext: (contextId: string) => void
  removeParagraphContexts: (paragraphId: string) => void
  clearContexts: () => void
  reset: () => void
}

const SELECTION_PARAGRAPH_CONTEXT_ID = "selection:paragraph"

function getManualParagraphContextId(paragraphId: string) {
  return `manual:paragraph:${paragraphId}`
}

function createParagraphContext(
  input: ParagraphContextInput,
  source: ChatParagraphContext["source"],
  contextId: string
): ChatParagraphContext {
  return {
    context_id: contextId,
    kind: "paragraph",
    source,
    paragraph_id: input.paragraph_id,
    chapter_id: input.chapter_id,
    chapter_title: input.chapter_title ?? null,
    content: input.content,
    para_type: input.para_type,
    selected_text: input.selected_text,
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  contextItems: [],

  upsertManualParagraphContext: (input, options) =>
    set((state) => {
      const moveToEnd = options?.moveToEnd ?? true
      const context_id = getManualParagraphContextId(input.paragraph_id)
      const nextItem = createParagraphContext(input, "manual", context_id)

      const existingIndex = state.contextItems.findIndex((item) => item.context_id === context_id)
      if (existingIndex === -1) {
        return { contextItems: [...state.contextItems, nextItem] }
      }

      const existing = state.contextItems[existingIndex]
      const merged = { ...existing, ...nextItem } as ChatParagraphContext
      if (!moveToEnd) {
        return {
          contextItems: state.contextItems.map((item, index) => (
            index === existingIndex ? merged : item
          )),
        }
      }

      const remaining = state.contextItems.filter((item) => item.context_id !== context_id)
      return { contextItems: [...remaining, merged] }
    }),

  upsertSelectionParagraphContext: (input) =>
    set((state) => {
      const nextItem = createParagraphContext(input, "selection", SELECTION_PARAGRAPH_CONTEXT_ID)
      const remaining = state.contextItems.filter((item) => (
        !(item.kind === "paragraph" && item.source === "selection")
      ))
      return { contextItems: [...remaining, nextItem] }
    }),

  updateParagraphContextContent: (paragraphId, content) =>
    set((state) => ({
      contextItems: state.contextItems.map((item) => (
        item.kind === "paragraph" && item.paragraph_id === paragraphId
          ? { ...item, content }
          : item
      )),
    })),

  removeContext: (contextId) =>
    set((state) => ({
      contextItems: state.contextItems.filter((item) => item.context_id !== contextId),
    })),

  removeParagraphContexts: (paragraphId) =>
    set((state) => ({
      contextItems: state.contextItems.filter((item) => (
        item.kind !== "paragraph" || item.paragraph_id !== paragraphId
      )),
    })),

  clearContexts: () => set({ contextItems: [] }),

  reset: () => set({ contextItems: [] }),
}))
