"use client"

import { useState, useCallback } from "react"
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
}

// ----------------------------------------------------------------
// 单个树节点
// ----------------------------------------------------------------
interface TreeNodeProps {
  node: ChapterTreeNode
  documentId: string
  depth: number
  onReload: () => void
}

function TreeNode({ node, documentId, depth, onReload }: TreeNodeProps) {
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
          "group flex items-center gap-1 py-1.5 pr-2 rounded-sm cursor-pointer select-none transition-colors",
          isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
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
          {node.children.map(child => (
            <TreeNode
              key={child.chapter_id}
              node={child}
              documentId={documentId}
              depth={depth + 1}
              onReload={onReload}
            />
          ))}
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
export default function ChapterTree({ documentId, onReload }: ChapterTreeProps) {
  const { tree } = useDocumentStore()
  const [adding, setAdding] = useState(false)

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
        {tree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">暂无章节</p>
        ) : (
          tree.map(node => (
            <TreeNode
              key={node.chapter_id}
              node={node}
              documentId={documentId}
              depth={0}
              onReload={onReload}
            />
          ))
        )}
      </div>
    </div>
  )
}
