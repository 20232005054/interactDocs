"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { coreInfoService } from "@/services/coreInfoService"
import { useDocumentStore } from "@/store/documentStore"
import type { CoreInfo } from "@/types/api"
import { cn } from "@/lib/utils"
import { toastError } from "@/hooks/useToast"

// ----------------------------------------------------------------
// 单个核心信息节点
// ----------------------------------------------------------------
interface CoreInfoNodeProps {
  node: CoreInfo
  depth: number
  onChangeContent: (coreInfoId: string, content: string) => void
}

function CoreInfoNode({ node, depth, onChangeContent }: CoreInfoNodeProps) {
  const { updateCoreInfo } = useDocumentStore()
  const [collapsed, setCollapsed] = useState(false)

  const isGroup = node.field_type === "group"
  const hasChildren = node.children.length > 0

  const handleChange = (val: string) => {
    onChangeContent(node.core_info_id, val)
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
      toastError(err instanceof Error ? err.message : "操作失败")
    }
  }

  return (
    // 动态树形缩进，Tailwind 无法静态生成，保留内联 style
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

      </div>

      {/* 内容编辑区（非 group 类型） */}
      {!isGroup && (
        <div className="mb-2" style={{ paddingLeft: "14px" }}>
          {node.field_type === "select" && node.options?.length ? (
            <select
              value={node.content}
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
          ) : node.field_type === "number" ? (
            <input
              type="number"
              value={node.content}
              onChange={e => handleChange(e.target.value)}
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
              value={node.content}
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
              onChangeContent={onChangeContent}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CoreInfoPanelProps {
  onAfterSave?: () => Promise<void>
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function CoreInfoPanel({ onAfterSave }: CoreInfoPanelProps) {
  const { coreInfoTree, updateCoreInfo } = useDocumentStore()
  const [originalContentMap, setOriginalContentMap] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用 ref 保存最新值，避免 timer 回调里读到旧闭包
  const dirtyIdsRef = useRef<Set<string>>(new Set())
  const flatNodesRef = useRef<CoreInfo[]>([])

  const flattenCoreInfo = useCallback((tree: CoreInfo[]): CoreInfo[] => {
    const result: CoreInfo[] = []
    const visit = (nodes: CoreInfo[]) => {
      nodes.forEach((node) => {
        result.push(node)
        if (node.children.length > 0) visit(node.children)
      })
    }
    visit(tree)
    return result
  }, [])

  const flatNodes = useMemo(() => flattenCoreInfo(coreInfoTree), [coreInfoTree, flattenCoreInfo])

  // 同步最新 flatNodes 到 ref
  useEffect(() => {
    flatNodesRef.current = flatNodes
  }, [flatNodes])

  useEffect(() => {
    if (flatNodes.length === 0) {
      setOriginalContentMap({})
      setDirtyIds(new Set())
      return
    }

    setOriginalContentMap((prev) => {
      const next = { ...prev }
      const liveIds = new Set(flatNodes.map((node) => node.core_info_id))

      flatNodes.forEach((node) => {
        if (!(node.core_info_id in next)) {
          next[node.core_info_id] = node.content ?? ""
        }
      })

      Object.keys(next).forEach((id) => {
        if (!liveIds.has(id)) delete next[id]
      })

      return next
    })
  }, [flatNodes])

  const handleSave = useCallback(async () => {
    const currentDirtyIds = dirtyIdsRef.current
    const currentFlatNodes = flatNodesRef.current
    if (currentDirtyIds.size === 0 || saving) return

    const contentMap = new Map(currentFlatNodes.map((node) => [node.core_info_id, node.content ?? ""]))
    const payload = Array.from(currentDirtyIds).map((id) => ({
      id,
      content: contentMap.get(id) ?? "",
    }))

    setSaving(true)
    try {
      await Promise.all(
        payload.map((item) => coreInfoService.update(item.id, { content: item.content }))
      )

      setOriginalContentMap((prev) => {
        const next = { ...prev }
        payload.forEach((item) => {
          next[item.id] = item.content
        })
        return next
      })
      dirtyIdsRef.current = new Set()
      setDirtyIds(new Set())

      if (onAfterSave) {
        await onAfterSave()
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [onAfterSave, saving])

  const handleNodeContentChange = useCallback((coreInfoId: string, content: string) => {
    updateCoreInfo(coreInfoId, { content })
    setDirtyIds((prev) => {
      const next = new Set(prev)
      const baseline = originalContentMap[coreInfoId] ?? ""
      if ((content ?? "") === baseline) {
        next.delete(coreInfoId)
      } else {
        next.add(coreInfoId)
      }
      // 同步到 ref，确保 timer 回调读到最新值
      dirtyIdsRef.current = next
      return next
    })

    // 防抖自动保存：停止输入 800ms 后触发
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void handleSave()
    }, 800)
  }, [originalContentMap, updateCoreInfo, handleSave])

  if (coreInfoTree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400">
        暂无核心信息
      </div>
    )
  }

  return (
    <div className="px-3 py-3">
      {saving && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          自动保存中...
        </div>
      )}
      <div className="flex flex-col">
        {coreInfoTree.map(node => (
          <CoreInfoNode
            key={node.core_info_id}
            node={node}
            depth={0}
            onChangeContent={handleNodeContentChange}
          />
        ))}
      </div>
    </div>
  )
}
