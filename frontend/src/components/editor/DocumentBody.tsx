"use client"

import { useRef, useState, useCallback } from "react"
import { paragraphService } from "@/services/paragraphService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore } from "@/store/editorStore"
import { useChatStore } from "@/store/chatStore"
import type { ChapterTreeNode, Paragraph } from "@/types/api"
import { cn } from "@/lib/utils"
import ParagraphToolbar from "@/components/editor/ParagraphToolbar"
import ParagraphEditor, { type ParagraphEditorHandle } from "@/components/editor/ParagraphEditor"
import { toastError } from "@/hooks/useToast"

interface DocumentBodyProps {
  onReload: () => void
}

// DFS 展开树为有序平铺列表（保留层级信息）
interface FlatChapter {
  node: ChapterTreeNode
  depth: number
}

function flattenTree(nodes: ChapterTreeNode[], depth = 0): FlatChapter[] {
  const result: FlatChapter[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children.length) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

// ----------------------------------------------------------------
// 段落行
// ----------------------------------------------------------------
interface ParagraphRowProps {
  paragraph: Paragraph
  chapterId: string
  chapterTitle: string
  prevParagraphId?: string
  onReload: () => void
  onRequestFocus?: (paragraphId: string, position: "start" | "end") => void
}

function ParagraphRow({
  paragraph,
  chapterId,
  chapterTitle,
  prevParagraphId,
  onReload,
  onRequestFocus,
}: ParagraphRowProps) {
  const { updateParagraph } = useDocumentStore()
  const { setActiveParagraphId, activeParagraphId } = useEditorStore()
  const upsertSelectionParagraphContext = useChatStore((state) => state.upsertSelectionParagraphContext)
  const updateParagraphContextContent = useChatStore((state) => state.updateParagraphContextContent)
  const removeParagraphContexts = useChatStore((state) => state.removeParagraphContexts)

  const [localContent, setLocalContent] = useState(paragraph.content)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rowHovered, setRowHovered] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<ParagraphEditorHandle>(null)
  const isActive = activeParagraphId === paragraph.paragraph_id

  const handleChange = useCallback((val: string) => {
    setLocalContent(val)
    updateParagraph(chapterId, paragraph.paragraph_id, val)
    updateParagraphContextContent(paragraph.paragraph_id, val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await paragraphService.update(paragraph.paragraph_id, { content: val })
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [chapterId, paragraph.paragraph_id, updateParagraph, updateParagraphContextContent])

  const handleInsertAfter = async () => {
    setMenuOpen(false)
    try {
      await paragraphService.insertAfter(paragraph.paragraph_id, { content: "" })
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "插入失败")
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    try {
      await paragraphService.delete(paragraph.paragraph_id)
      removeParagraphContexts(paragraph.paragraph_id)
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    }
  }

  const handleTypeChange = async (paraType: Paragraph["para_type"]) => {
    setMenuOpen(false)
    try {
      await paragraphService.update(paragraph.paragraph_id, { para_type: paraType })
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "修改失败")
    }
  }

  // Enter 在末尾：插入新段落
  const handleEnterAtEnd = useCallback(async () => {
    try {
      const newPara = await paragraphService.insertAfter(paragraph.paragraph_id, { content: "" })
      onReload()
      // 等 DOM 更新后聚焦新段落
      setTimeout(() => {
        onRequestFocus?.(newPara.paragraph_id, "start")
      }, 100)
    } catch {
      // 静默失败
    }
  }, [paragraph.paragraph_id, onReload, onRequestFocus])

  // Backspace 在开头：聚焦上一段落末尾（内容为空时删除）
  const handleBackspaceAtStart = useCallback(async () => {
    if (localContent.trim() === "" && prevParagraphId) {
      try {
        await paragraphService.delete(paragraph.paragraph_id)
        removeParagraphContexts(paragraph.paragraph_id)
        onReload()
        setTimeout(() => {
          onRequestFocus?.(prevParagraphId, "end")
        }, 100)
      } catch {
        // 静默失败
      }
    } else if (prevParagraphId) {
      onRequestFocus?.(prevParagraphId, "end")
    }
  }, [localContent, prevParagraphId, paragraph.paragraph_id, removeParagraphContexts, onReload, onRequestFocus])

  const paraTypeLabel: Record<Paragraph["para_type"], string> = {
    paragraph: "正文",
    heading1: "一级标题",
    heading2: "二级标题",
    heading3: "三级标题",
  }

  return (
    <div
      className={cn(
        "group/paragraph relative flex gap-2 py-0.5",
        isActive && "bg-blue-50/40 rounded"
      )}
      onClick={() => setActiveParagraphId(paragraph.paragraph_id)}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      {/* 左侧操作区 */}
      <div className="w-6 shrink-0 flex items-start justify-center pt-1.5 opacity-0 group-hover/paragraph:opacity-100 transition">
        <div className="relative">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded text-xs"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-full top-0 ml-1 z-50 bg-white border border-gray-200 rounded-md shadow-md py-1 min-w-32 text-xs">
                <div className="px-3 py-1 text-gray-400 text-xs">段落类型</div>
                {(["paragraph", "heading1", "heading2", "heading3"] as Paragraph["para_type"][]).map(t => (
                  <button key={t} onClick={() => handleTypeChange(t)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 hover:bg-gray-50",
                      paragraph.para_type === t ? "text-blue-600 font-medium" : "text-gray-700"
                    )}>
                    {paraTypeLabel[t]}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={handleInsertAfter}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">在后面插入段落</button>
                <button onClick={handleDelete}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500">删除段落</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 编辑区 */}
      <div
        className="relative flex-1 min-w-0"
        onClick={() => {
          // 点击编辑区时同步选中上下文
          upsertSelectionParagraphContext({
            paragraph_id: paragraph.paragraph_id,
            chapter_id: chapterId,
            chapter_title: chapterTitle,
            content: localContent,
            para_type: paragraph.para_type,
          })
        }}
      >
        <ParagraphEditor
          ref={editorRef}
          paragraphId={paragraph.paragraph_id}
          content={localContent}
          paraType={paragraph.para_type}
          isChanged={paragraph.ischange === 1}
          onChange={handleChange}
          onEnterAtEnd={handleEnterAtEnd}
          onBackspaceAtStart={handleBackspaceAtStart}
          onFocus={() => setActiveParagraphId(paragraph.paragraph_id)}
        />

        {/* 变更标记 */}
        {paragraph.ischange === 1 && (
          <span className="text-xs text-orange-400 ml-1">已变更</span>
        )}

        {/* AI 工具栏（仅正文段落） */}
        {paragraph.para_type === "paragraph" && (
          <div className="mt-1">
            <ParagraphToolbar
              paragraphId={paragraph.paragraph_id}
              chapterId={chapterId}
              chapterTitle={chapterTitle}
              paragraphContent={localContent}
              paraType={paragraph.para_type}
              hasContent={localContent.trim().length > 0}
              visible={rowHovered}
            />
          </div>
        )}
      </div>

      {/* 保存状态 */}
      {saving && (
        <span className="absolute right-2 top-2 text-xs text-gray-300">保存中</span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 章节块
// ----------------------------------------------------------------
interface ChapterBlockProps {
  flatChapter: FlatChapter
  onReload: () => void
}

function ChapterBlock({ flatChapter, onReload }: ChapterBlockProps) {
  const { node, depth } = flatChapter
  const { activeChapterId } = useEditorStore()
  const isActive = activeChapterId === node.chapter_id
  const [addingPara, setAddingPara] = useState(false)

  // 段落 ref map，用于跨段落焦点控制
  const editorRefs = useRef<Map<string, ParagraphEditorHandle>>(new Map())

  const handleRequestFocus = useCallback((paragraphId: string, position: "start" | "end") => {
    const handle = editorRefs.current.get(paragraphId)
    if (handle) {
      if (position === "end") handle.focusEnd()
      else handle.focus()
    }
  }, [])

  const handleAddParagraph = async () => {
    setAddingPara(true)
    try {
      await paragraphService.create(node.chapter_id, { content: "", para_type: "paragraph" })
      onReload()
    } finally {
      setAddingPara(false)
    }
  }

  const titleCls = cn(
    "font-semibold text-gray-900 leading-snug",
    depth === 0 && "text-xl",
    depth === 1 && "text-lg",
    depth >= 2 && "text-base",
  )

  const sortedParagraphs = [...node.paragraphs].sort((a, b) => a.order_index - b.order_index)

  return (
    <div
      id={`chapter-${node.chapter_id}`}
      className={cn(
        "mb-6 scroll-mt-4",
        isActive && "ring-1 ring-blue-200 ring-offset-2 rounded-lg"
      )}
    >
      {/* 章节标题 */}
      <div
        className={cn(
          "flex items-center gap-2 mb-3 pb-2",
          depth === 0 && "border-b border-gray-200",
          depth === 1 && "border-b border-gray-100",
        )}
        style={{ paddingLeft: `${depth * 8}px` }}
      >
        <h2 className={titleCls}>{node.title}</h2>
        {node.status === 1 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">已完成</span>
        )}
      </div>

      {/* 段落列表 */}
      <div
        className="flex flex-col gap-1"
        style={{ paddingLeft: `${depth * 8 + 4}px` }}
      >
        {sortedParagraphs.length === 0 ? (
          <button
            onClick={handleAddParagraph}
            disabled={addingPara}
            className="text-sm text-gray-300 hover:text-gray-500 text-left py-2 transition"
          >
            + 点击添加段落
          </button>
        ) : (
          <>
            {sortedParagraphs.map((p, idx) => (
              <ParagraphRow
                key={p.paragraph_id}
                paragraph={p}
                chapterId={node.chapter_id}
                chapterTitle={node.title}
                prevParagraphId={idx > 0 ? sortedParagraphs[idx - 1].paragraph_id : undefined}
                onReload={onReload}
                onRequestFocus={handleRequestFocus}
              />
            ))}
            <button
              onClick={handleAddParagraph}
              disabled={addingPara}
              className="text-xs text-gray-300 hover:text-gray-400 text-left py-1 transition opacity-0 hover:opacity-100 group-hover/paragraph:opacity-100"
            >
              + 添加段落
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function DocumentBody({ onReload }: DocumentBodyProps) {
  const { tree } = useDocumentStore()
  const flatList = flattenTree(tree)

  if (flatList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-24">
        <p className="text-base mb-2">文档暂无章节</p>
        <p className="text-sm">在左侧章节树点击 + 添加章节</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      {flatList.map(fc => (
        <ChapterBlock
          key={fc.node.chapter_id}
          flatChapter={fc}
          onReload={onReload}
        />
      ))}
    </div>
  )
}
