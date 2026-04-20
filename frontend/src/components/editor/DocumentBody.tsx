"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { paragraphService } from "@/services/paragraphService"
import { chapterService } from "@/services/chapterService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore } from "@/store/editorStore"
import type { ChapterTreeNode, Paragraph } from "@/types/api"
import { cn } from "@/lib/utils"
import ParagraphToolbar from "@/components/editor/ParagraphToolbar"

interface DocumentBodyProps {
  documentId: string
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
  onReload: () => void
}

function ParagraphRow({ paragraph, chapterId, onReload }: ParagraphRowProps) {
  const { updateParagraph } = useDocumentStore()
  const { setActiveParagraphId, activeParagraphId } = useEditorStore()

  const [localContent, setLocalContent] = useState(paragraph.content)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEditingRef = useRef(false) // 用户正在输入时不覆盖 localContent
  const isActive = activeParagraphId === paragraph.paragraph_id

  // 当 store 里的 paragraph.content 被外部更新（如 AI apply）时同步到本地
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalContent(paragraph.content)
    }
  }, [paragraph.content])

  // 初始渲染后自动撑高 textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [localContent])

  const handleChange = (val: string) => {
    isEditingRef.current = true
    setLocalContent(val)
    updateParagraph(chapterId, paragraph.paragraph_id, val)
    // 防抖保存
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await paragraphService.update(paragraph.paragraph_id, { content: val })
      } finally {
        setSaving(false)
        isEditingRef.current = false
      }
    }, 800)
  }

  const handleInsertAfter = async () => {
    setMenuOpen(false)
    try {
      await paragraphService.insertAfter(paragraph.paragraph_id, { content: "" })
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "插入失败")
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    try {
      await paragraphService.delete(paragraph.paragraph_id)
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败")
    }
  }

  const handleTypeChange = async (paraType: Paragraph["para_type"]) => {
    setMenuOpen(false)
    try {
      await paragraphService.update(paragraph.paragraph_id, { para_type: paraType })
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "修改失败")
    }
  }

  const paraTypeLabel: Record<Paragraph["para_type"], string> = {
    paragraph: "正文",
    heading1: "一级标题",
    heading2: "二级标题",
    heading3: "三级标题",
  }

  return (
    <div
      className={cn(
        "group relative flex gap-2",
        isActive && "bg-blue-50/40 rounded"
      )}
      onClick={() => setActiveParagraphId(paragraph.paragraph_id)}
    >
      {/* 左侧操作区 */}
      <div className="w-6 shrink-0 flex items-start justify-center pt-1.5 opacity-0 group-hover:opacity-100 transition">
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
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setActiveParagraphId(paragraph.paragraph_id)}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent outline-none leading-relaxed",
            "overflow-hidden",
            paragraph.para_type === "heading1" && "text-xl font-bold text-gray-900",
            paragraph.para_type === "heading2" && "text-lg font-semibold text-gray-800",
            paragraph.para_type === "heading3" && "text-base font-medium text-gray-700",
            paragraph.para_type === "paragraph" && "text-sm text-gray-700",
            paragraph.ischange === 1 && "border-l-2 border-orange-400 pl-2"
          )}
          style={{ height: "auto" }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = "auto"
            el.style.height = `${el.scrollHeight}px`
          }}
          placeholder={paragraph.para_type === "paragraph" ? "输入正文内容..." : "输入标题..."}
        />
        {/* 变更标记 */}
        {paragraph.ischange === 1 && (
          <span className="text-xs text-orange-400 ml-1">已变更</span>
        )}
        {/* AI 工具栏（仅正文段落，且当前段落激活时显示） */}
        {paragraph.para_type === "paragraph" && isActive && (
          <div className="mt-1">
            <ParagraphToolbar
              paragraphId={paragraph.paragraph_id}
              chapterId={chapterId}
              hasContent={localContent.trim().length > 0}
            />
          </div>
        )}
      </div>

      {/* 保存状态 */}
      {saving && (
        <span className="absolute right-2 top-1.5 text-xs text-gray-300">保存中</span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 章节块
// ----------------------------------------------------------------
interface ChapterBlockProps {
  flatChapter: FlatChapter
  documentId: string
  onReload: () => void
}

function ChapterBlock({ flatChapter, documentId, onReload }: ChapterBlockProps) {
  const { node, depth } = flatChapter
  const { activeChapterId } = useEditorStore()
  const isActive = activeChapterId === node.chapter_id
  const [addingPara, setAddingPara] = useState(false)

  const handleAddParagraph = async () => {
    setAddingPara(true)
    try {
      await paragraphService.create(node.chapter_id, { content: "", para_type: "paragraph" })
      onReload()
    } finally {
      setAddingPara(false)
    }
  }

  // 章节标题字号随层级变化
  const titleCls = cn(
    "font-semibold text-gray-900 leading-snug",
    depth === 0 && "text-xl",
    depth === 1 && "text-lg",
    depth >= 2 && "text-base",
  )

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
        className="flex flex-col gap-0"
        style={{ paddingLeft: `${depth * 8 + 4}px` }}
      >
        {node.paragraphs.length === 0 ? (
          <button
            onClick={handleAddParagraph}
            disabled={addingPara}
            className="text-sm text-gray-300 hover:text-gray-500 text-left py-2 transition"
          >
            + 点击添加段落
          </button>
        ) : (
          <>
            {node.paragraphs
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map(p => (
                <ParagraphRow
                  key={p.paragraph_id}
                  paragraph={p}
                  chapterId={node.chapter_id}
                  onReload={onReload}
                />
              ))}
            {/* 末尾添加段落 */}
            <button
              onClick={handleAddParagraph}
              disabled={addingPara}
              className="text-xs text-gray-300 hover:text-gray-400 text-left py-1 transition opacity-0 hover:opacity-100 group-hover:opacity-100"
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
export default function DocumentBody({ documentId, onReload }: DocumentBodyProps) {
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
          documentId={documentId}
          onReload={onReload}
        />
      ))}
    </div>
  )
}
