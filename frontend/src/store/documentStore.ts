"use client"

import { create } from "zustand"
import type { ChapterTreeNode, Summary, CoreInfo } from "@/types/api"

interface DocumentStore {
  documentId: string | null
  documentTitle: string | null

  // 全量内容树（章节 + 段落）
  tree: ChapterTreeNode[]
  // 摘要列表
  summaries: Summary[]
  // 核心信息树
  coreInfoTree: CoreInfo[]

  // 设置全量内容
  setFullContent: (documentId: string, title: string, tree: ChapterTreeNode[]) => void
  // 更新单个章节标题（重命名后局部更新）
  updateChapterTitle: (chapterId: string, title: string) => void
  // 更新单个段落内容（编辑后局部更新）
  updateParagraph: (chapterId: string, paragraphId: string, content: string) => void

  // 摘要
  setSummaries: (summaries: Summary[]) => void
  updateSummary: (summaryId: string, patch: Partial<Summary>) => void

  // 核心信息
  setCoreInfoTree: (tree: CoreInfo[]) => void
  updateCoreInfo: (coreInfoId: string, patch: Partial<CoreInfo>) => void

  // 重置（离开文档时清空）
  reset: () => void
}

// 递归更新树中某个章节的标题
function updateTitleInTree(tree: ChapterTreeNode[], chapterId: string, title: string): ChapterTreeNode[] {
  return tree.map(node => {
    if (node.chapter_id === chapterId) return { ...node, title }
    if (node.children.length) return { ...node, children: updateTitleInTree(node.children, chapterId, title) }
    return node
  })
}

// 递归更新树中某个章节的某个段落
function updateParagraphInTree(
  tree: ChapterTreeNode[],
  chapterId: string,
  paragraphId: string,
  content: string
): ChapterTreeNode[] {
  return tree.map(node => {
    if (node.chapter_id === chapterId) {
      return {
        ...node,
        paragraphs: node.paragraphs.map(p =>
          p.paragraph_id === paragraphId ? { ...p, content } : p
        ),
      }
    }
    if (node.children.length) {
      return { ...node, children: updateParagraphInTree(node.children, chapterId, paragraphId, content) }
    }
    return node
  })
}

// 递归更新核心信息树
function updateCoreInfoInTree(tree: CoreInfo[], coreInfoId: string, patch: Partial<CoreInfo>): CoreInfo[] {
  return tree.map(node => {
    if (node.core_info_id === coreInfoId) return { ...node, ...patch }
    if (node.children.length) return { ...node, children: updateCoreInfoInTree(node.children, coreInfoId, patch) }
    return node
  })
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documentId: null,
  documentTitle: null,
  tree: [],
  summaries: [],
  coreInfoTree: [],

  setFullContent: (documentId, title, tree) =>
    set({ documentId, documentTitle: title, tree }),

  updateChapterTitle: (chapterId, title) =>
    set(state => ({ tree: updateTitleInTree(state.tree, chapterId, title) })),

  updateParagraph: (chapterId, paragraphId, content) =>
    set(state => ({ tree: updateParagraphInTree(state.tree, chapterId, paragraphId, content) })),

  setSummaries: (summaries) => set({ summaries }),

  updateSummary: (summaryId, patch) =>
    set(state => ({
      summaries: state.summaries.map(s => s.summary_id === summaryId ? { ...s, ...patch } : s),
    })),

  setCoreInfoTree: (coreInfoTree) => set({ coreInfoTree }),

  updateCoreInfo: (coreInfoId, patch) =>
    set(state => ({ coreInfoTree: updateCoreInfoInTree(state.coreInfoTree, coreInfoId, patch) })),

  reset: () => set({ documentId: null, documentTitle: null, tree: [], summaries: [], coreInfoTree: [] }),
}))
