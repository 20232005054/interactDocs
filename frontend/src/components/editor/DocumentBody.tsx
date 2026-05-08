"use client"

import { useRef, useState, useCallback } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
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
// 可拖拽的段落行
// ----------------------------------------------------------------
interface SortableParagraphRowProps {
  paragraph: Paragraph
  chapterId: string
  chapterTitle: string
  prevParagraphId?: string
  onReload: () => void
  onRequestFocus?: (paragraphId: string, position: "start" | "end") => void
}

function SortableParagraphRow(props: SortableParagraphRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.paragraph.paragraph_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none",
        isDragging && "opacity-50 z-50"
      )}
    >
      <ParagraphRow
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
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
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function ParagraphRow({
  paragraph,
  chapterId,
  chapterTitle,
  prevParagraphId,
  onReload,
  onRequestFocus,
  dragHandleProps,
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

  // AI 改写选中文本
  const handleAIRewrite = useCallback((selectedText: string) => {
    // TODO: 实现 AI 改写功能
    console.log("AI 改写:", selectedText)
    toastError("AI 改写功能开发中...")
  }, [])

  // 添加选中文本到对话上下文
  const handleAddToContext = useCallback((selectedText: string) => {
    upsertSelectionParagraphContext({
      paragraph_id: paragraph.paragraph_id,
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      content: localContent,
      para_type: paragraph.para_type,
      selected_text: selectedText, // 添加选中的文本片段
    })
  }, [paragraph.paragraph_id, chapterId, chapterTitle, localContent, paragraph.para_type, upsertSelectionParagraphContext])

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
        "group/paragraph relative flex gap-2 py-2 px-2 rounded-lg transition-all duration-200",
        isActive && "paragraph-active shadow-sm",
        rowHovered && !isActive && "paragraph-hover"
      )}
      onClick={() => setActiveParagraphId(paragraph.paragraph_id)}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      {/* 左侧操作区 */}
      <div className="w-6 shrink-0 flex items-start justify-center pt-2 opacity-0 group-hover/paragraph:opacity-100 transition-opacity duration-200">
        <div className="relative flex flex-col gap-1">
          {/* 拖拽手柄 */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing shrink-0 transition"
              title="拖动排序"
              onClick={e => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-gray-300 hover:text-gray-500" />
            </div>
          )}
          
          {/* 菜单按钮 */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded text-xs transition-colors"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-full top-0 ml-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-32 text-xs">
                <div className="px-3 py-1 text-gray-400 text-xs font-medium">段落类型</div>
                {(["paragraph", "heading1", "heading2", "heading3"] as Paragraph["para_type"][]).map(t => (
                  <button key={t} onClick={() => handleTypeChange(t)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors",
                      paragraph.para_type === t ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"
                    )}>
                    {paraTypeLabel[t]}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={handleInsertAfter}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 transition-colors">在后面插入段落</button>
                <button onClick={handleDelete}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500 transition-colors">删除段落</button>
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
          // 如果该段落已经是手动添加的上下文，则不添加 selection 上下文（避免重复）
          const hasManualContext = useChatStore.getState().contextItems.some((item) => (
            item.kind === "paragraph" && 
            item.source === "manual" && 
            item.paragraph_id === paragraph.paragraph_id
          ))
          
          if (!hasManualContext) {
            upsertSelectionParagraphContext({
              paragraph_id: paragraph.paragraph_id,
              chapter_id: chapterId,
              chapter_title: chapterTitle,
              content: localContent,
              para_type: paragraph.para_type,
            })
          }
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
          onAIRewrite={handleAIRewrite}
          onAddToContext={handleAddToContext}
        />

        {/* 变更标记 + 确认按钮 */}
        {paragraph.ischange !== 0 && (
          <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-1.5 text-xs text-amber-600 px-2 py-1 rounded-md border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium">
                {paragraph.ischange === 1 ? "已变更" : "系统重新生成"}
              </span>
            </div>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  await paragraphService.confirmChange(paragraph.paragraph_id)
                  onReload()
                } catch (err: unknown) {
                  toastError(err instanceof Error ? err.message : "确认失败")
                }
              }}
              className="text-xs px-3 py-1 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors shadow-sm font-medium"
            >
              确认变更
            </button>
          </div>
        )}

        {/* AI 工具栏（仅正文段落） */}
        {paragraph.para_type === "paragraph" && (
          <div className="mt-2 opacity-0 group-hover/paragraph:opacity-100 transition-opacity duration-200">
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
        <div className="absolute right-3 top-3 save-indicator saving">
          保存中
        </div>
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
  documentId: string
}

function ChapterBlock({ flatChapter, onReload, documentId }: ChapterBlockProps) {
  const { node, depth } = flatChapter
  const { activeChapterId } = useEditorStore()
  const isActive = activeChapterId === node.chapter_id
  const [addingPara, setAddingPara] = useState(false)
  const [localParagraphs, setLocalParagraphs] = useState<Paragraph[]>([])

  // 段落 ref map，用于跨段落焦点控制
  const editorRefs = useRef<Map<string, ParagraphEditorHandle>>(new Map())

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 初始化本地段落状态
  const sortedParagraphs = [...node.paragraphs].sort((a, b) => a.order_index - b.order_index)
  
  // 同步段落列表
  if (JSON.stringify(localParagraphs.map(p => p.paragraph_id)) !== JSON.stringify(sortedParagraphs.map(p => p.paragraph_id))) {
    setLocalParagraphs(sortedParagraphs)
  }

  const handleRequestFocus = useCallback((paragraphId: string, position: "start" | "end") => {
    const handle = editorRefs.current.get(paragraphId)
    if (handle) {
      if (position === "end") handle.focusEnd()
      else handle.focus()
    }
  }, [])

  // 拖拽结束处理
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = localParagraphs.findIndex((p) => p.paragraph_id === active.id)
    const newIndex = localParagraphs.findIndex((p) => p.paragraph_id === over.id)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // 重新排序
    const newParagraphs = [...localParagraphs]
    const [movedParagraph] = newParagraphs.splice(oldIndex, 1)
    newParagraphs.splice(newIndex, 0, movedParagraph)

    // 更新本地状态
    setLocalParagraphs(newParagraphs)

    // 调用后端 reorder 接口
    try {
      const items = newParagraphs.map((p, index) => ({
        paragraph_id: p.paragraph_id,
        chapter_id: node.chapter_id,
        order_index: index,
      }))
      await paragraphService.reorder(documentId, items)
      // 拖拽成功后刷新
      onReload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : "排序失败")
      // 失败时恢复原状态
      setLocalParagraphs(sortedParagraphs)
    }
  }, [localParagraphs, node.chapter_id, documentId, onReload, sortedParagraphs])

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
    "font-bold leading-tight transition-colors",
    depth === 0 && "text-3xl mb-2 text-gray-900",
    depth === 1 && "text-2xl mb-1.5 text-gray-800",
    depth >= 2 && "text-xl text-gray-700",
  )

  return (
    <div
      id={`chapter-${node.chapter_id}`}
      className={cn(
        "mb-8 scroll-mt-4 transition-all duration-200",
        isActive && "ring-2 ring-blue-200 ring-offset-4 rounded-xl p-4 bg-blue-50/30"
      )}
    >
      {/* 章节标题 */}
      {/* 动态缩进：树形结构深度不可预测，使用内联 style 计算 paddingLeft */}
      <div
        className={cn(
          "flex items-center gap-3 mb-3 pb-2 group/title",
          depth === 0 && "border-b-2 border-gray-200 chapter-title-decoration",
          depth === 1 && "border-b border-gray-100 pl-1",
        )}
        style={{ paddingLeft: depth >= 2 ? `${depth * 8}px` : undefined }}
      >
        {depth === 1 && (
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-300 rounded-full" />
        )}
        {depth >= 2 && (
          <div className="w-2 h-2 rounded-full bg-blue-400" />
        )}
        <h2 className={titleCls}>{node.title}</h2>
        {node.status === 1 && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            已完成
          </span>
        )}
      </div>

      {/* 段落列表 */}
      {/* 动态缩进：树形结构深度不可预测，使用内联 style 计算 paddingLeft */}
      <div
        className="flex flex-col gap-2"
        style={{ paddingLeft: `${depth * 8 + 4}px` }}
      >
        {localParagraphs.length === 0 ? (
          <button
            onClick={handleAddParagraph}
            disabled={addingPara}
            className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-left py-3 px-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">+</span>
              <span>点击添加段落</span>
            </span>
          </button>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localParagraphs.map((p) => p.paragraph_id)}
              strategy={verticalListSortingStrategy}
            >
              {localParagraphs.map((p, idx) => (
                <SortableParagraphRow
                  key={p.paragraph_id}
                  paragraph={p}
                  chapterId={node.chapter_id}
                  chapterTitle={node.title}
                  prevParagraphId={idx > 0 ? localParagraphs[idx - 1].paragraph_id : undefined}
                  onReload={onReload}
                  onRequestFocus={handleRequestFocus}
                />
              ))}
            </SortableContext>
            <button
              onClick={handleAddParagraph}
              disabled={addingPara}
              className="text-xs text-gray-300 hover:text-gray-500 hover:bg-gray-50 text-left py-2 px-3 rounded-md transition-all duration-200 opacity-0 hover:opacity-100 group-hover/paragraph:opacity-100"
            >
              + 添加段落
            </button>
          </DndContext>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
interface DocumentBodyProps {
  onReload: () => void
  documentId: string
}

export default function DocumentBody({ onReload, documentId }: DocumentBodyProps) {
  const { tree } = useDocumentStore()
  const flatList = flattenTree(tree)

  if (flatList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-24">
        <div className="text-6xl mb-4 opacity-20">📝</div>
        <p className="text-base mb-2 font-medium">文档暂无章节</p>
        <p className="text-sm text-gray-400">在左侧章节树点击 + 添加章节</p>
      </div>
    )
  }

  return (
    <div className="editor-content-area h-full">
      <div className="h-full px-16 py-8">
        {flatList.map(fc => (
          <ChapterBlock
            key={fc.node.chapter_id}
            flatChapter={fc}
            onReload={onReload}
            documentId={documentId}
          />
        ))}
      </div>
    </div>
  )
}
