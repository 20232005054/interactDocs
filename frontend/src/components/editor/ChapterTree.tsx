"use client"

import { useState, useCallback, useEffect } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { chapterService } from "@/services/chapterService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore } from "@/store/editorStore"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { toastError } from "@/hooks/useToast"
import type { ChapterTreeNode } from "@/types/api"
import { cn } from "@/lib/utils"

interface ChapterTreeProps {
  documentId: string
  onReload: () => void
  onRefreshContent?: () => Promise<void> // 轻量级刷新章节内容
}

// ----------------------------------------------------------------
// 可拖拽的树节点
// ----------------------------------------------------------------
interface SortableTreeNodeProps {
  node: ChapterTreeNode
  documentId: string
  depth: number
  onReload: () => void
}

function SortableTreeNode({ node, documentId, depth, onReload }: SortableTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.chapter_id })

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
      <TreeNode
        node={node}
        documentId={documentId}
        depth={depth}
        onReload={onReload}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// 单个树节点
// ----------------------------------------------------------------
interface TreeNodeProps {
  node: ChapterTreeNode
  documentId: string
  depth: number
  onReload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function TreeNode({ node, documentId, depth, onReload, dragHandleProps }: TreeNodeProps) {
  const { activeChapterId, setActiveChapterId } = useEditorStore()
  const { updateChapterTitle } = useDocumentStore()

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(node.title)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isActive = activeChapterId === node.chapter_id
  const hasChildren = node.children.length > 0

  const handleClick = () => {
    setActiveChapterId(node.chapter_id)
    // 滚动到中间区域对应章节
    const el = document.getElementById(`chapter-${node.chapter_id}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleRename = async () => {
    if (!editTitle.trim() || editTitle === node.title) {
      setEditing(false)
      setEditTitle(node.title)
      return
    }
    setSaving(true)
    try {
      await chapterService.update(node.chapter_id, { title: editTitle.trim() })
      updateChapterTitle(node.chapter_id, editTitle.trim())
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleAddSub = async () => {
    setMenuOpen(false)
    try {
      await chapterService.createSub(documentId, node.chapter_id)
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "添加失败")
    }
  }

  const handleInsertAfter = async () => {
    setMenuOpen(false)
    try {
      await chapterService.insertAfter(documentId, node.chapter_id)
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "添加失败")
    }
  }

  const handleDelete = async () => {
    try {
      await chapterService.delete(node.chapter_id)
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setConfirmDelete(false)
    }
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1.5 pr-2 rounded-sm cursor-pointer select-none transition-colors border-l-4",
          isActive 
            ? "bg-blue-50 text-blue-700 border-blue-500 font-semibold" 
            : "text-gray-700 hover:bg-gray-100 border-transparent"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* 拖拽手柄 */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition"
            title="拖动排序"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
          </div>
        )}

        {/* 折叠按钮 */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setCollapsed(v => !v) }}
          className={cn(
            "w-4 h-4 flex items-center justify-center text-gray-400 shrink-0 transition-transform",
            !hasChildren && "invisible",
            collapsed && "-rotate-90"
          )}
        >
          ▾
        </button>

        {/* 标题 */}
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === "Enter") handleRename()
              if (e.key === "Escape") { setEditing(false); setEditTitle(node.title) }
            }}
            disabled={saving}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none"
          />
        ) : (
          <span
            className="flex-1 text-xs truncate"
            onClick={handleClick}
            onDoubleClick={() => setEditing(true)}
          >
            {node.title}
          </span>
        )}

        {/* 操作菜单触发 */}
        {!editing && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded transition"
            >
              ···
            </button>
            {menuOpen && (
              <>
                {/* 点击外部关闭 */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-md py-1 min-w-28 text-xs">
                  <button onClick={() => { setMenuOpen(false); setEditing(true) }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">重命名</button>
                  <button onClick={handleInsertAfter}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">在后面插入</button>
                  <button onClick={handleAddSub}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">添加子章节</button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500">删除</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 子节点 */}
      {!collapsed && hasChildren && (
        <div>
          <SortableContext
            items={node.children.map((child) => child.chapter_id)}
            strategy={verticalListSortingStrategy}
          >
            {node.children.map(child => (
              <SortableTreeNode
                key={child.chapter_id}
                node={child}
                documentId={documentId}
                depth={depth + 1}
                onReload={onReload}
              />
            ))}
          </SortableContext>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`删除章节「${node.title}」？`}
        description="此操作不可撤销，章节下的所有段落也会一并删除。"
        confirmLabel="删除"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function ChapterTree({ documentId, onReload, onRefreshContent }: ChapterTreeProps) {
  const { tree } = useDocumentStore()
  const [adding, setAdding] = useState(false)
  const [localTree, setLocalTree] = useState<ChapterTreeNode[]>([])

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 初始化本地树状态
  useEffect(() => {
    setLocalTree(tree)
  }, [tree])

  // 拖拽结束处理
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // 查找被拖拽节点和目标节点
    const findNodeAndParent = (tree: ChapterTreeNode[], id: string, parent: ChapterTreeNode | null = null): { node: ChapterTreeNode; parent: ChapterTreeNode | null } | null => {
      for (const node of tree) {
        if (node.chapter_id === id) {
          return { node, parent }
        }
        if (node.children.length > 0) {
          const result = findNodeAndParent(node.children, id, node)
          if (result) return result
        }
      }
      return null
    }

    const activeResult = findNodeAndParent(localTree, active.id as string)
    const overResult = findNodeAndParent(localTree, over.id as string)

    if (!activeResult || !overResult) return

    // 只支持同级拖拽（parent_id 相同）
    const activeParentId = activeResult.parent?.chapter_id ?? null
    const overParentId = overResult.parent?.chapter_id ?? null

    if (activeParentId !== overParentId) {
      toastError("暂不支持跨层级拖拽")
      return
    }

    // 获取同级所有节点
    const siblings = activeResult.parent ? activeResult.parent.children : localTree
    const oldIndex = siblings.findIndex((n) => n.chapter_id === active.id)
    const newIndex = siblings.findIndex((n) => n.chapter_id === over.id)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // 重新排序
    const newSiblings = [...siblings]
    const [movedNode] = newSiblings.splice(oldIndex, 1)
    newSiblings.splice(newIndex, 0, movedNode)

    // 更新本地状态
    const updateTree = (tree: ChapterTreeNode[]): ChapterTreeNode[] => {
      if (activeResult.parent) {
        return tree.map((node) => {
          if (node.chapter_id === activeResult.parent!.chapter_id) {
            return { ...node, children: newSiblings }
          }
          if (node.children.length > 0) {
            return { ...node, children: updateTree(node.children) }
          }
          return node
        })
      }
      return newSiblings
    }

    const newTree = updateTree(localTree)
    setLocalTree(newTree)

    // 调用后端 reorder 接口
    try {
      const orderedIds = newSiblings.map((n) => n.chapter_id)
      await chapterService.reorder(documentId, {
        parent_id: activeParentId,
        ordered_ids: orderedIds,
      })
      // 拖拽成功后轻量级刷新章节内容（不重新加载整个页面）
      if (onRefreshContent) {
        await onRefreshContent()
      } else {
        // 降级方案：如果没有提供轻量级刷新，则使用完整刷新
        onReload()
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "排序失败")
      // 失败时恢复原状态
      setLocalTree(localTree)
    }
  }, [localTree, documentId, onReload, onRefreshContent])

  const handleAddRoot = useCallback(async () => {
    setAdding(true)
    try {
      await chapterService.create(documentId)
      onReload()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "添加失败")
    } finally {
      setAdding(false)
    }
  }, [documentId, onReload])

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">章节</span>
        <button
          onClick={handleAddRoot}
          disabled={adding}
          className="text-xs text-gray-400 hover:text-blue-500 transition disabled:opacity-50"
          title="添加章节"
        >
          +
        </button>
      </div>

      {/* 树列表 */}
      <div className="compact-scrollbar flex-1 overflow-y-auto py-1">
        {localTree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">暂无章节</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localTree.map((node) => node.chapter_id)}
              strategy={verticalListSortingStrategy}
            >
              {localTree.map(node => (
                <SortableTreeNode
                  key={node.chapter_id}
                  node={node}
                  documentId={documentId}
                  depth={0}
                  onReload={onReload}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
