"use client"

import { useRef, useState } from "react"
import { coreInfoService } from "@/services/coreInfoService"
import { useDocumentStore } from "@/store/documentStore"
import type { CoreInfo } from "@/types/api"
import { cn } from "@/lib/utils"

// ----------------------------------------------------------------
// 单个核心信息节点
// ----------------------------------------------------------------
interface CoreInfoNodeProps {
  node: CoreInfo
  depth: number
  onReload: () => void
}

function CoreInfoNode({ node, depth, onReload }: CoreInfoNodeProps) {
  const { updateCoreInfo } = useDocumentStore()
  const [localContent, setLocalContent] = useState(node.content)
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isGroup = node.field_type === "group"
  const hasChildren = node.children.length > 0

  const handleChange = (val: string) => {
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

  return (
    <div style={{ paddingLeft: `${depth * 12}px` }}>
      {/* 节点头部 */}
      <div className="flex items-center gap-1 py-1 group">
        {/* 折叠按钮（仅 group 类型） */}
        {isGroup ? (
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

        {/* 字段名 */}
        <span className={cn(
          "text-xs shrink-0",
          isGroup ? "font-medium text-gray-700" : "text-gray-500",
          node.is_change === 1 && "text-orange-500"
        )}>
          {node.title}
          {node.is_required && !isGroup && (
            <span className="text-red-400 ml-0.5">*</span>
          )}
        </span>

        {/* 锁定按钮 */}
        {!isGroup && (
          <button
            type="button"
            onClick={handleToggleLock}
            title={node.is_locked ? "解锁" : "锁定"}
            className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition text-xs"
          >
            {node.is_locked ? "🔒" : "🔓"}
          </button>
        )}

        {saving && <span className="ml-auto text-xs text-gray-300">…</span>}
      </div>

      {/* 内容编辑区（非 group 类型） */}
      {!isGroup && (
        <div className="mb-2" style={{ paddingLeft: "14px" }}>
          {node.field_type === "select" && node.options?.length ? (
            <select
              value={localContent}
              onChange={e => handleChange(e.target.value)}
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
          ) : (
            <textarea
              value={localContent}
              onChange={e => handleChange(e.target.value)}
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
export default function CoreInfoPanel() {
  const { coreInfoTree } = useDocumentStore()

  if (coreInfoTree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400">
        暂无核心信息
      </div>
    )
  }

  return (
    <div className="px-3 py-3">
      <div className="flex flex-col">
        {coreInfoTree.map(node => (
          <CoreInfoNode
            key={node.core_info_id}
            node={node}
            depth={0}
            onReload={() => {}}
          />
        ))}
      </div>
    </div>
  )
}
