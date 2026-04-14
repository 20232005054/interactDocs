"use client"

import { create } from "zustand"

export type RightPanelTab = "core-info" | "summary" | "chat"

interface EditorStore {
  // 当前高亮/定位的章节 ID（左侧树高亮 + 中间区域滚动定位）
  activeChapterId: string | null
  setActiveChapterId: (id: string | null) => void

  // 右侧面板当前 tab
  rightPanelTab: RightPanelTab
  setRightPanelTab: (tab: RightPanelTab) => void

  // 当前正在编辑的段落 ID（用于工具栏定位）
  activeParagraphId: string | null
  setActiveParagraphId: (id: string | null) => void

  // AI 帮填：正在流式生成的段落 ID
  aiAssistingParagraphId: string | null
  setAiAssistingParagraphId: (id: string | null) => void

  // AI 帮填预览内容（流式缓冲）
  aiAssistPreview: string
  setAiAssistPreview: (content: string) => void
  appendAiAssistPreview: (chunk: string) => void
  clearAiAssistPreview: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeChapterId: null,
  setActiveChapterId: (id) => set({ activeChapterId: id }),

  rightPanelTab: "core-info",
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  activeParagraphId: null,
  setActiveParagraphId: (id) => set({ activeParagraphId: id }),

  aiAssistingParagraphId: null,
  setAiAssistingParagraphId: (id) => set({ aiAssistingParagraphId: id }),

  aiAssistPreview: "",
  setAiAssistPreview: (content) => set({ aiAssistPreview: content }),
  appendAiAssistPreview: (chunk) => set(state => ({ aiAssistPreview: state.aiAssistPreview + chunk })),
  clearAiAssistPreview: () => set({ aiAssistPreview: "" }),
}))
