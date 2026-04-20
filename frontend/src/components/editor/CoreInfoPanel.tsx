"use client"

import { useRef, useState } from "react"
import { coreInfoService } from "@/services/coreInfoService"
import { useDocumentStore } from "@/store/documentStore"
import type { CoreInfo } from "@/types/api"
import { cn } from "@/lib/utils"

interface CoreInfoPanelProps {
  documentId: string
}

// ----------------------------------------------------------------
// 单个核心信息节点
// ----------------------------------------------------------------
interface CoreInfoNodeProps {
  node: CoreInfo
  depth: number
  documentId: string
  onReload: () => void
}

function CoreInfoNode({ node, depth, documentId, onReload }: CoreInfoNodeProps) {
  const { updateCoreInfo } = useDocumentStore()
  const [localContent, setLocalContent] = useState(node.content)
  const [localTitle, setLocalTitle] = useState(node.title)
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isGroup = node.field_type === "group"
  const hasChildren = node.children.length > 0

  const handleContentChange = (val: string) => {
    setLocalContent(val)
    updateCoreInfo(node.core_info_id, { content: val })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await coreInfoService.update(node.core_info_id, { content: val })
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  const handleTitleChange = (val: string) => {
    setLocalTitle(val)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      try {
        await coreInfoService.update(node.core_info_id, { title: val })
        updateCoreInfo(node.core_info_id, { title: val })
      } catch {
        // 静默失败
      }
    }, 600)
  }

  const handleToggleLock = async () => {
    try {
      if (node.is_locked) {
        const updated = await coreInfoService.unlock(node.core_info_id)
        updateCoreInfo(node.core_info_id, { is_locked: updated.is_locked })
      } else {
        const updated = await coreInfoService.lock(node.core_info_id)
        updateCoreInfo(node.core_info_id, { is_locked: updated.is_locked })
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleAddChild = async () => {
    setAdding(true)
    setMenuOpen(false)
    try {
      await coreInfoService.create(documentId, {
        title: "新字段",
        content: "",
        parent_id: node.core_info_id,
      })
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "新增失败")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确认删除「${node.title}」？`)) return
    setDeleting(true)
    setMenuOpen(false)
    try {
      await coreInfoService.delete(node.core_info_id)
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ paddingLeft: `${depth * 12}px` }}>
      {/* 节点头部 */}
      <div className="flex items-center gap-1 py-1 group">
        {/* 折叠按钮 */}
        {isGroup || hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              "w-3.5 h-3.5 flex items-center justify-center text-gray-400 shrink-0 transition-transform text-xs",
              collapsed && "-rotate-90"
            )}
          >
            ▾
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* 字段名（双击编辑） */}
        {editingTitle ? (
          <input
            autoFocus
            value={localTitle}
            onChange={e => handleTitleChange(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
            className="flex-1 text-xs border-b border-blue-300 outline-none bg-transparent"
          />
        ) : (
          <span
            onDoubleClick={() => !node.is_locked && setEditingTitle(true)}
            className={cn(
              "flex-1 text-xs truncate",
              isGroup ? "font-medium text-gray-700" : "text-gray-500",
              node.is_change === 1 && "text-orange-500"
            )}
            title={localTitle}
          >
            {localTitle}
            {node.is_required && !isGroup && (
              <span className="text-red-400 ml-0.5">*</span>
            )}
          </span>
        )}

        {/* 操作菜单 */}
        <div className="relative opacity-0 group-hover:opacity-100 transition shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            disabled={deleting || adding}
            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded text-xs"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-0.5 z-50 bg-white border border-gray-200 rounded-md shadow-md py-1 min-w-28 text-xs">
                <button
                  onClick={() => { setMenuOpen(false); handleToggleLock() }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                >
                  {node.is_locked ? "🔓 解锁" : "🔒 锁定"}
                </button>
                <button
                  onClick={handleAddChild}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                >
                  + 添加子字段
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={node.is_locked}
                  className={cn(
                    "w-full text-left px-3 py-1.5",
                    node.is_locked
                      ? "text-gray-300 cursor-not-allowed"
                      : "hover:bg-red-50 text-red-500"
                  )}
                >
                  删除
                </button>
              </div>
            </>
          )}
        </div>

        {saving && <span className="text-xs text-gray-300 shrink-0">…</span>}
      </div>

      {/* 内容编辑区（非 group 类型） */}
      {!isGroup && (
        <div className="mb-2" style={{ paddingLeft: "14px" }}>
          {node.field_type === "select" && node.options?.length ? (
            <select
              value={localContent}
              onChange={e => handleContentChange(e.target.value)}
              disabled={node.is_locked}
              className={cn(
                "w-full h-7 rounded border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-300 transition",
                node.is_locked && "bg-gray-50 text-gray-400 cursor-not-allowed"
              )}
            >
              <option value="">请选择</option>
              {node.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : node.field_type === "number" ? (
            <input
              type="number"
              value={localContent}
              onChange={e => handleContentChange(e.target.value)}
              disabled={node.is_locked}
              className={cn(
                "w-full h-7 rounded border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-300 transition",
                node.is_locked && "bg-gray-50 text-gray-400 cursor-not-allowed",
                node.is_change === 1 && "border-orange-300 bg-orange-50/30"
              )}
              placeholder={node.is_locked ? "已锁定" : "请输入数值..."}
            />
          ) : (
            <textarea
              value={localContent}
              onChange={e => handleContentChange(e.target.value)}
              disabled={node.is_locked}
              rows={1}
              className={cn(
                "w-full resize-none rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-300 transition leading-relaxed",
                node.is_locked && "bg-gray-50 text-gray-400 cursor-not-allowed",
                node.is_change === 1 && "border-orange-300 bg-orange-50/30"
              )}
              style={{ height: "auto" }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = `${el.scrollHeight}px`
              }}
              placeholder={node.is_locked ? "已锁定" : "请输入..."}
            />
          )}
        </div>
      )}

      {/* 子节点 */}
      {!collapsed && hasChildren && (
        <div className="border-l border-gray-100 ml-1.5 pl-1">
          {node.children.map(child => (
            <CoreInfoNode
              key={child.core_info_id}
              node={child}
              depth={0}
              documentId={documentId}
              onReload={onReload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function CoreInfoPanel({ documentId }: CoreInfoPanelProps) {
  const { coreInfoTree, setCoreInfoTree } = useDocumentStore()
  const [adding, setAdding] = useState(false)

  const reload = async () => {
    try {
      const res = await coreInfoService.getByDocument(documentId)
      setCoreInfoTree(res.items)
    } catch {
      // 静默失败
    }
  }

  const handleAddRoot = async () => {
    setAdding(true)
    try {
      await coreInfoService.create(documentId, {
        title: "新字段",
        content: "",
        parent_id: null,
      })
      await reload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "新增失败")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {coreInfoTree.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-gray-400">
            暂无核心信息
          </div>
        ) : (
          <div className="flex flex-col">
            {coreInfoTree.map(node => (
              <CoreInfoNode
                key={node.core_info_id}
                node={node}
                depth={0}
                documentId={documentId}
                onReload={reload}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部新增按钮 */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={handleAddRoot}
          disabled={adding}
          className="w-full h-7 rounded border border-dashed border-gray-300 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition disabled:opacity-50"
        >
          {adding ? "添加中..." : "+ 添加核心信息字段"}
        </button>
      </div>
    </div>
  )
}
