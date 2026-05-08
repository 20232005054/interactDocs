"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, Plus } from "lucide-react"
import { coreInfoService } from "@/services/coreInfoService"
import { useDocumentStore } from "@/store/documentStore"
import type { CoreInfo } from "@/types/api"
import { cn } from "@/lib/utils"
import { toastError, toastSuccess } from "@/hooks/useToast"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import CreateCoreInfoDialog from "@/components/editor/CreateCoreInfoDialog"

// ----------------------------------------------------------------
// 可拖拽的核心信息节点
// ----------------------------------------------------------------
interface SortableCoreInfoNodeProps {
  node: CoreInfo
  depth: number
  onChangeContent: (coreInfoId: string, content: string) => void
  onDelete: (coreInfoId: string) => void
}

function SortableCoreInfoNode({ node, depth, onChangeContent, onDelete }: SortableCoreInfoNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.core_info_id })

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
      <CoreInfoNode
        node={node}
        depth={depth}
        onChangeContent={onChangeContent}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// 单个核心信息节点
// ----------------------------------------------------------------
interface CoreInfoNodeProps {
  node: CoreInfo
  depth: number
  onChangeContent: (coreInfoId: string, content: string) => void
  onDelete: (coreInfoId: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function CoreInfoNode({ node, depth, onChangeContent, onDelete, dragHandleProps }: CoreInfoNodeProps) {
  const { updateCoreInfo } = useDocumentStore()
  const [collapsed, setCollapsed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [localValue, setLocalValue] = useState(node.content)

  // 同步外部变更到本地状态
  useEffect(() => {
    setLocalValue(node.content)
  }, [node.content])

  const isGroup = node.field_type === "group"
  const hasChildren = node.children.length > 0

  const handleChange = (val: string) => {
    // 始终更新本地状态（让输入框响应）
    setLocalValue(val)
    
    // 非组合期间才更新 store 和触发保存
    if (!isComposing) {
      updateCoreInfo(node.core_info_id, { content: val })
      onChangeContent(node.core_info_id, val)
    }
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsComposing(false)
    const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value
    // 组合结束时更新 store 和触发保存
    updateCoreInfo(node.core_info_id, { content: val })
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

  const handleDelete = () => {
    if (node.is_locked) {
      toastError("核心信息已锁定，无法删除")
      return
    }
    setConfirmDelete(true)
  }

  return (
    <>
      {/* 动态缩进：树形结构深度不可预测，使用内联 style 计算 paddingLeft */}
      <div style={{ paddingLeft: `${depth * 12}px` }}>
        {/* 节点头部 */}
        <div className="flex items-center gap-1 py-1 group">
          {/* 拖拽手柄 */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition"
              title="拖动排序"
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
            </div>
          )}

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
            "text-base shrink-0",
            isGroup ? "font-medium text-gray-700" : "text-gray-600",
            node.is_change === 1 && "text-orange-500"
          )}>
            {node.title}
            {node.is_required && !isGroup && (
              <span className="text-red-400 ml-0.5">*</span>
            )}
          </span>

          {/* 操作按钮组 */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            {/* 锁定按钮 */}
            {!isGroup && (
              <button
                type="button"
                onClick={handleToggleLock}
                title={node.is_locked ? "解锁" : "锁定"}
                className="text-gray-300 hover:text-gray-500 transition text-xs"
              >
                {node.is_locked ? "🔒" : "🔓"}
              </button>
            )}

            {/* 删除按钮 */}
            <button
              type="button"
              onClick={handleDelete}
              title={node.is_locked ? "已锁定，无法删除" : "删除"}
              disabled={node.is_locked}
              className={cn(
                "transition",
                node.is_locked
                  ? "text-gray-200 cursor-not-allowed"
                  : "text-gray-300 hover:text-red-500"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      {/* 内容编辑区（非 group 类型） */}
      {/* 固定缩进：保持与上方节点头部的视觉对齐 */}
      {!isGroup && (
        <div className="mb-2" style={{ paddingLeft: "14px" }}>
          {node.field_type === "select" && node.options?.length ? (
            <select
              value={localValue}
              onChange={e => handleChange(e.target.value)}
              disabled={node.is_locked}
              className={cn(
                "w-full h-9 rounded border border-gray-200 bg-white px-3 text-base outline-none focus:border-blue-300 transition",
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
              value={localValue}
              onChange={e => handleChange(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={handleCompositionEnd}
              disabled={node.is_locked}
              className={cn(
                "w-full h-9 rounded border border-gray-200 bg-white px-3 text-base outline-none focus:border-blue-300 transition",
                node.is_locked && "bg-gray-50 text-gray-400 cursor-not-allowed",
                node.is_change === 1 && "border-orange-300 bg-orange-50/30"
              )}
              placeholder={node.is_locked ? "已锁定" : "请输入数值..."}
            />
          ) : (
            // 自适应高度：textarea 根据内容动态调整高度
            <textarea
              value={localValue}
              onChange={e => handleChange(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={handleCompositionEnd}
              disabled={node.is_locked}
              rows={1}
              className={cn(
                "w-full resize-none rounded border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-blue-300 transition leading-relaxed",
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
          <SortableContext
            items={node.children.map((child) => child.core_info_id)}
            strategy={verticalListSortingStrategy}
          >
            {node.children.map(child => (
              <SortableCoreInfoNode
                key={child.core_info_id}
                node={child}
                depth={0}
                onChangeContent={onChangeContent}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>

    {/* 删除确认对话框 */}
    <ConfirmDialog
      open={confirmDelete}
      title={`删除核心信息「${node.title}」？`}
      description={hasChildren ? "此操作不可撤销，该节点及其所有子节点将被永久删除。" : "此操作不可撤销，核心信息将被永久删除。"}
      confirmLabel="删除"
      destructive
      onConfirm={() => {
        onDelete(node.core_info_id)
        setConfirmDelete(false)
      }}
      onCancel={() => setConfirmDelete(false)}
    />
  </>
  )
}

interface CoreInfoPanelProps {
  onAfterSave?: () => Promise<void>
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function CoreInfoPanel({ onAfterSave }: CoreInfoPanelProps) {
  const { coreInfoTree, updateCoreInfo, documentId, setCoreInfoTree } = useDocumentStore()
  const [originalContentMap, setOriginalContentMap] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用 ref 保存最新值，避免 timer 回调里读到旧闭包
  const dirtyIdsRef = useRef<Set<string>>(new Set())
  const flatNodesRef = useRef<CoreInfo[]>([])
  const [localCoreInfoTree, setLocalCoreInfoTree] = useState<CoreInfo[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 初始化本地树状态
  useEffect(() => {
    setLocalCoreInfoTree(coreInfoTree)
  }, [coreInfoTree])

  // 拖拽结束处理
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !documentId) return

    // 查找被拖拽节点和目标节点
    const findNodeAndParent = (tree: CoreInfo[], id: string, parent: CoreInfo | null = null): { node: CoreInfo; parent: CoreInfo | null } | null => {
      for (const node of tree) {
        if (node.core_info_id === id) {
          return { node, parent }
        }
        if (node.children.length > 0) {
          const result = findNodeAndParent(node.children, id, node)
          if (result) return result
        }
      }
      return null
    }

    const activeResult = findNodeAndParent(localCoreInfoTree, active.id as string)
    const overResult = findNodeAndParent(localCoreInfoTree, over.id as string)

    if (!activeResult || !overResult) return

    // 只支持同级拖拽（parent_id 相同）
    const activeParentId = activeResult.parent?.core_info_id ?? null
    const overParentId = overResult.parent?.core_info_id ?? null

    if (activeParentId !== overParentId) {
      toastError("暂不支持跨层级拖拽")
      return
    }

    // 获取同级所有节点
    const siblings = activeResult.parent ? activeResult.parent.children : localCoreInfoTree
    const oldIndex = siblings.findIndex((n) => n.core_info_id === active.id)
    const newIndex = siblings.findIndex((n) => n.core_info_id === over.id)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // 重新排序
    const newSiblings = [...siblings]
    const [movedNode] = newSiblings.splice(oldIndex, 1)
    newSiblings.splice(newIndex, 0, movedNode)

    // 更新本地状态
    const updateTree = (tree: CoreInfo[]): CoreInfo[] => {
      if (activeResult.parent) {
        return tree.map((node) => {
          if (node.core_info_id === activeResult.parent!.core_info_id) {
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

    const newTree = updateTree(localCoreInfoTree)
    setLocalCoreInfoTree(newTree)

    // 调用后端 reorder 接口
    try {
      const orderedIds = newSiblings.map((n) => n.core_info_id)
      await coreInfoService.reorder(documentId, {
        parent_id: activeParentId,
        ordered_ids: orderedIds,
      })
    } catch (err) {
      toastError(err instanceof Error ? err.message : "排序失败")
      // 失败时恢复原状态
      setLocalCoreInfoTree(localCoreInfoTree)
    }
  }, [localCoreInfoTree, documentId])

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

  const flatNodes = useMemo(() => flattenCoreInfo(localCoreInfoTree), [localCoreInfoTree, flattenCoreInfo])

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

  const handleDelete = useCallback(async (coreInfoId: string) => {
    try {
      await coreInfoService.delete(coreInfoId)
      toastSuccess("核心信息已删除")
      // 递归移除节点及其子节点
      const removeNode = (tree: CoreInfo[]): CoreInfo[] => {
        return tree.filter((node) => {
          if (node.core_info_id === coreInfoId) return false
          if (node.children.length > 0) {
            node.children = removeNode(node.children)
          }
          return true
        })
      }
      setLocalCoreInfoTree((prev) => removeNode(prev))
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    }
  }, [])

  const handleCreate = useCallback(async (data: {
    title: string
    field_type: string
    parent_id: string | null
    is_required: boolean
    options?: string[]
  }) => {
    if (!documentId) return

    setCreating(true)
    try {
      const newCoreInfo = await coreInfoService.create(documentId, {
        title: data.title,
        content: "",
        field_type: data.field_type,
        parent_id: data.parent_id,
        is_required: data.is_required,
        options: data.options,
      })

      // 刷新核心信息树
      const treeRes = await coreInfoService.getByDocument(documentId)
      setCoreInfoTree(treeRes.items)
      setLocalCoreInfoTree(treeRes.items)

      toastSuccess("核心信息已创建")
      setShowCreateDialog(false)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setCreating(false)
    }
  }, [documentId, setCoreInfoTree])

  if (localCoreInfoTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8">
        <p className="text-xs text-gray-400 mb-4">暂无核心信息</p>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          disabled={!documentId || creating}
          className="h-8 px-4 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建核心信息</span>
        </button>
        <CreateCoreInfoDialog
          open={showCreateDialog}
          onConfirm={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
          coreInfoTree={localCoreInfoTree}
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">核心信息</h3>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          disabled={!documentId || creating}
          className="h-7 px-3 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建</span>
        </button>
      </div>

      {saving && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          自动保存中...
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col">
          <SortableContext
            items={localCoreInfoTree.map((node) => node.core_info_id)}
            strategy={verticalListSortingStrategy}
          >
            {localCoreInfoTree.map(node => (
              <SortableCoreInfoNode
                key={node.core_info_id}
                node={node}
                depth={0}
                onChangeContent={handleNodeContentChange}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* 新建对话框 */}
      <CreateCoreInfoDialog
        open={showCreateDialog}
        onConfirm={handleCreate}
        onCancel={() => setShowCreateDialog(false)}
        coreInfoTree={localCoreInfoTree}
      />
    </div>
  )
}
