"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { ChevronDown, CornerDownRight, Plus, Trash2 } from "lucide-react"
import { coreInfoTemplateService } from "@/services/templateService"
import type { CoreInfoDependencyItem, CoreInfoTemplate, FieldType } from "@/types/api"
import { cn } from "@/lib/utils"
import { setCoreInfoDragData } from "@/lib/templateDrag"
import { toastError } from "@/hooks/useToast"
import DependencyHoverCard from "@/components/template/DependencyHoverCard"

interface CoreInfoTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
  enableDrag?: boolean
  dependencyItems?: CoreInfoDependencyItem[]
}

// ----------------------------------------------------------------
// 单行编辑表单（内联）
// ----------------------------------------------------------------
interface RowFormProps {
  templateId: string
  parentId: string | null
  afterId?: string | null
  initial?: CoreInfoTemplate
  onDone: () => void
  onCancel: () => void
}

function RowForm({ templateId, parentId, afterId = null, initial, onDone, onCancel }: RowFormProps) {
  const [fieldName, setFieldName] = useState(initial?.field_name ?? "")
  const [fieldType, setFieldType] = useState<FieldType>(initial?.field_type ?? "text")
  const [defaultValue, setDefaultValue] = useState(initial?.default_value ?? "")
  const [optionsRaw, setOptionsRaw] = useState(initial?.options?.join("\n") ?? "")
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fieldName.trim()) { setError("字段名称不能为空"); return }
    setLoading(true)
    setError(null)
    try {
      const options = fieldType === "select"
        ? optionsRaw.split("\n").map(s => s.trim()).filter(Boolean)
        : null

      if (initial) {
        await coreInfoTemplateService.update(initial.core_template_id, {
          field_name: fieldName.trim(),
          field_type: fieldType,
          default_value: defaultValue.trim() || null,
          options,
          is_required: isRequired,
        })
      } else if (afterId) {
        await coreInfoTemplateService.insertAfter(templateId, {
          after_id: afterId,
          field_name: fieldName.trim(),
          field_type: fieldType,
          default_value: defaultValue.trim() || null,
          options,
          is_required: isRequired,
        })
      } else {
        await coreInfoTemplateService.create({
          template_id: templateId,
          parent_id: parentId,
          field_name: fieldName.trim(),
          field_type: fieldType,
          default_value: defaultValue.trim() || null,
          options,
          is_required: isRequired,
        })
      }
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border border-border">
      <div className="flex gap-2 flex-wrap">
        <input
          autoFocus
          type="text"
          value={fieldName}
          onChange={e => setFieldName(e.target.value)}
          placeholder="字段名称"
          className="h-8 flex-1 min-w-32 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={fieldType}
          onChange={e => setFieldType(e.target.value as FieldType)}
          className="h-8 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="text">文本</option>
          <option value="number">数值</option>
          <option value="select">下拉选择</option>
          <option value="group">分组</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={e => setIsRequired(e.target.checked)}
            className="accent-primary"
          />
          必填
        </label>
      </div>

      {fieldType === "text" && (
        <input
          type="text"
          value={defaultValue}
          onChange={e => setDefaultValue(e.target.value)}
          placeholder="默认值（可选）"
          className="h-8 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      {fieldType === "select" && (
        <textarea
          value={optionsRaw}
          onChange={e => setOptionsRaw(e.target.value)}
          placeholder={"每行一个选项\n例如：\n选项A\n选项B"}
          rows={3}
          className="rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-3 rounded border border-border text-xs text-muted-foreground hover:bg-muted transition"
        >
          取消
        </button>
      </div>
    </form>
  )
}

// ----------------------------------------------------------------
// 树节点
// ----------------------------------------------------------------
interface TreeNodeProps {
  node: CoreInfoTemplate
  templateId: string
  depth: number
  onRefresh: () => void
  editingNodeId: string | null
  onStartEdit: (nodeId: string) => void
  onStopEdit: (nodeId: string) => void
  enableDrag: boolean
  dependencyMap: Map<string, CoreInfoDependencyItem>
  sortDragging: { id: string; parentId: string | null } | null
  sortOver: { id: string; parentId: string | null } | null
  onSortDragStart: (id: string, parentId: string | null) => void
  onSortDragEnd: () => void | Promise<void>
  onSortDragEnter: (targetId: string, targetParentId: string | null) => void
}

function collectNonGroupChildren(node: CoreInfoTemplate): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = []

  const walk = (list: CoreInfoTemplate[]) => {
    for (const item of list) {
      if (item.field_type === "group") {
        if (item.children?.length) walk(item.children)
        continue
      }
      result.push({ value: item.field_key, label: item.field_name })
      if (item.children?.length) walk(item.children)
    }
  }

  if (node.children?.length) walk(node.children)
  return result
}

function TreeNode({
  node,
  templateId,
  depth,
  onRefresh,
  editingNodeId,
  onStartEdit,
  onStopEdit,
  enableDrag,
  dependencyMap,
  sortDragging,
  sortOver,
  onSortDragStart,
  onSortDragEnd,
  onSortDragEnter,
}: TreeNodeProps) {
  const [addingSibling, setAddingSibling] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true) // 默认收起
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const editing = editingNodeId === node.core_template_id
  const hasChildren = (node.children?.length ?? 0) > 0
  // 排序能力在模板编辑页和应用模板页都开启，支持整行拖拽。
  const rowSortEnabled = true
  const canDropSort = !!sortDragging
    && sortDragging.parentId === node.parent_id
    && sortDragging.id !== node.core_template_id
  const isSortOver = canDropSort
    && !!sortOver
    && sortOver.id === node.core_template_id
    && sortOver.parentId === node.parent_id

  const handleDelete = async () => {
    try {
      await coreInfoTemplateService.delete(node.core_template_id)
      onRefresh()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const fieldTypeLabel: Record<FieldType, string> = {
    text: "文本",
    select: "下拉",
    group: "分组",
  }
  const dependencyItem = dependencyMap.get(node.field_key)

  useEffect(() => {
    if (!addMenuOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [addMenuOpen])

  return (
    <div className={cn("flex flex-col gap-1", depth > 0 && "ml-6 border-l border-border pl-3")}>
      {editing ? (
        <RowForm
          templateId={templateId}
          parentId={node.parent_id}
          initial={node}
          onDone={() => { onStopEdit(node.core_template_id); onRefresh() }}
          onCancel={() => onStopEdit(node.core_template_id)}
        />
      ) : (
        <div
          draggable={rowSortEnabled || enableDrag}
          onClick={() => {
            if (deleting) return
            onStartEdit(node.core_template_id)
          }}
          onDragStart={(event) => {
            if (rowSortEnabled) {
              event.dataTransfer.effectAllowed = enableDrag ? "copyMove" : "move"
              const payload = JSON.stringify({ id: node.core_template_id, parentId: node.parent_id })
              event.dataTransfer.setData(
                "application/x-coreinfo-sort",
                payload
              )
              // 应用模板页同时保留“拖到其他板块填充变量”的能力
              if (enableDrag) {
                setCoreInfoDragData(event, {
                  fieldKey: node.field_key,
                  label: node.field_name,
                  isGroup: node.field_type === "group",
                  groupChildren: node.field_type === "group" ? collectNonGroupChildren(node) : undefined,
                })
              }
              onSortDragStart(node.core_template_id, node.parent_id)
              return
            }
            setCoreInfoDragData(event, {
              fieldKey: node.field_key,
              label: node.field_name,
              isGroup: node.field_type === "group",
              groupChildren: node.field_type === "group" ? collectNonGroupChildren(node) : undefined,
            })
          }}
          onDragEnd={() => {
            if (rowSortEnabled) onSortDragEnd()
          }}
          onDragOver={(event) => {
            if (!canDropSort) return
            event.preventDefault()
            event.dataTransfer.dropEffect = "move"
            onSortDragEnter(node.core_template_id, node.parent_id)
          }}
          onDragEnter={(event) => {
            if (!canDropSort) return
            event.preventDefault()
            onSortDragEnter(node.core_template_id, node.parent_id)
          }}
          onDrop={async (event) => {
            if (!canDropSort) return
            event.preventDefault()
            event.stopPropagation()
            onSortDragEnter(node.core_template_id, node.parent_id)
            await onSortDragEnd()
          }}
          className={cn(
            "group rounded px-2 py-1.5 hover:bg-muted/40",
            (rowSortEnabled || enableDrag) && "cursor-grab active:cursor-grabbing",
            isSortOver && "ring-1 ring-primary/40 bg-primary/5"
          )}
          title={
            enableDrag
              ? "点击进入编辑；支持拖拽排序，也可拖到摘要模板或章节结构模板中自动填入"
              : "点击进入编辑；支持拖拽调整同级顺序"
          }
        >
          <div className="flex items-center gap-2">
            {/* 折叠箭头 */}
            {hasChildren && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  setCollapsed((prev) => !prev)
                }}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition"
                aria-label={collapsed ? "展开" : "折叠"}
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} />
              </button>
            )}
            {node.is_required && (
              <span className="text-sm font-semibold leading-none text-destructive">*</span>
            )}
            <span className="text-sm font-medium text-foreground flex-1">{node.field_name}</span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
              {fieldTypeLabel[node.field_type]}
            </span>
            {node.default_value && (
              <span className="text-xs text-muted-foreground truncate max-w-24">默认: {node.default_value}</span>
            )}

            {/* 操作按钮（hover 显示） */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <div ref={addMenuRef} className="relative">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    setAddMenuOpen((prev) => !prev)
                  }}
                  className="inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition"
                  title="添加节点"
                  aria-label="添加节点"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <ChevronDown className={cn("h-3 w-3 transition-transform", addMenuOpen && "rotate-180")} />
                </button>

                {addMenuOpen && (
                  <div
                    className="absolute right-0 top-7 z-20 min-w-28 rounded-md border border-border bg-background p-1 shadow-md"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAddingSibling(true)
                        setAddingChild(false)
                        setAddMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      插入同级节点
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingChild(true)
                        setAddingSibling(false)
                        setAddMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                      插入子级节点
                    </button>
                  </div>
                )}
              </div>
              {deleting ? (
                <>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDelete()
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    确认
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      setDeleting(false)
                    }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleting(true)
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive transition"
                  title="删除节点"
                  aria-label="删除节点"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-1 pl-1 text-[11px] text-muted-foreground">
            <span className="mr-1">被引用:</span>
            <DependencyHoverCard
              title="被引用详情"
              items={dependencyItem?.referenced_by ?? []}
              emptyText="暂无"
              tone="emerald"
            />
          </div>
        </div>
      )}

      {/* 插入同级节点表单（在当前节点后） */}
      {addingSibling && (
        <RowForm
          templateId={templateId}
          parentId={node.parent_id}
          afterId={node.core_template_id}
          onDone={() => { setAddingSibling(false); onRefresh() }}
          onCancel={() => setAddingSibling(false)}
        />
      )}

      {/* 添加子字段表单 */}
      {addingChild && (
        <div className="ml-6 border-l border-border pl-3">
          <RowForm
            templateId={templateId}
            parentId={node.core_template_id}
            onDone={() => { setAddingChild(false); onRefresh() }}
            onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {/* 子节点递归 */}
      {!collapsed && node.children?.map(child => (
        <TreeNode
          key={child.core_template_id}
          node={child}
          templateId={templateId}
          depth={depth + 1}
          onRefresh={onRefresh}
          editingNodeId={editingNodeId}
          onStartEdit={onStartEdit}
          onStopEdit={onStopEdit}
          enableDrag={enableDrag}
          dependencyMap={dependencyMap}
          sortDragging={sortDragging}
          sortOver={sortOver}
          onSortDragStart={onSortDragStart}
          onSortDragEnd={onSortDragEnd}
          onSortDragEnter={onSortDragEnter}
        />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function CoreInfoTemplateStep({
  templateId,
  onCountChange,
  enableDrag = false,
  dependencyItems = [],
}: CoreInfoTemplateStepProps) {
  const [items, setItems] = useState<CoreInfoTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingRoot, setAddingRoot] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [sortDragging, setSortDragging] = useState<{ id: string; parentId: string | null } | null>(null)
  const [sortOver, setSortOver] = useState<{ id: string; parentId: string | null } | null>(null)
  const sortDraggingRef = useRef<{ id: string; parentId: string | null } | null>(null)
  const sortOverRef = useRef<{ id: string; parentId: string | null } | null>(null)
  const dependencyMap = useMemo(
    () => new Map(dependencyItems.map((item) => [item.field_key, item])),
    [dependencyItems]
  )

  const countAll = useCallback((nodes: CoreInfoTemplate[]): number =>
    nodes.reduce((acc, n) => acc + 1 + countAll(n.children ?? []), 0), [])

  const reorderSiblings = useCallback((siblings: CoreInfoTemplate[], orderedIds: string[]): CoreInfoTemplate[] => {
    if (!siblings.length) return siblings
    const idToNode = new Map(siblings.map((node) => [node.core_template_id, node]))
    const orderedSet = new Set(orderedIds)
    const next: CoreInfoTemplate[] = []

    for (const id of orderedIds) {
      const node = idToNode.get(id)
      if (node) next.push(node)
    }
    for (const node of siblings) {
      if (!orderedSet.has(node.core_template_id)) next.push(node)
    }

    const unchanged = next.length === siblings.length && next.every((node, index) => node === siblings[index])
    return unchanged ? siblings : next
  }, [])

  const applySiblingOrder = useCallback((
    nodes: CoreInfoTemplate[],
    parentId: string | null,
    orderedIds: string[]
  ): CoreInfoTemplate[] => {
    if (parentId === null) {
      return reorderSiblings(nodes, orderedIds)
    }

    let changed = false
    const nextNodes = nodes.map((node) => {
      if (node.core_template_id === parentId) {
        const children = reorderSiblings(node.children ?? [], orderedIds)
        if (children !== (node.children ?? [])) {
          changed = true
          return { ...node, children }
        }
        return node
      }

      if (!node.children?.length) return node

      const nextChildren = applySiblingOrder(node.children, parentId, orderedIds)
      if (nextChildren !== node.children) {
        changed = true
        return { ...node, children: nextChildren }
      }
      return node
    })

    return changed ? nextNodes : nodes
  }, [reorderSiblings])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await coreInfoTemplateService.getByTemplate(templateId)
      setItems(res.items ?? [])
      setEditingNodeId((current) => {
        if (!current) return current
        const existsInTree = (nodes: CoreInfoTemplate[]): boolean =>
          nodes.some((node) =>
            node.core_template_id === current || existsInTree(node.children ?? [])
          )
        return existsInTree(res.items ?? []) ? current : null
      })
      onCountChange?.(countAll(res.items ?? []))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange, countAll])

  useEffect(() => { load() }, [load])

  const getSiblingIds = useCallback((nodes: CoreInfoTemplate[], parentId: string | null): string[] => {
    if (parentId === null) return nodes.map((node) => node.core_template_id)
    for (const node of nodes) {
      if (node.core_template_id === parentId) {
        return (node.children ?? []).map((child) => child.core_template_id)
      }
      const found = getSiblingIds(node.children ?? [], parentId)
      if (found.length) return found
    }
    return []
  }, [])

  const handleSortDrop = useCallback(async (
    sourceId: string,
    sourceParentId: string | null,
    targetParentId: string | null,
    targetId: string
  ) => {
    if (sourceParentId !== targetParentId) return
    if (sourceId === targetId) return

    const current = getSiblingIds(items, targetParentId)
    if (!current.length) return

    const dragIndex = current.indexOf(sourceId)
    const targetIndex = current.indexOf(targetId)
    if (dragIndex < 0 || targetIndex < 0) return

    const next = [...current]
    next.splice(dragIndex, 1)

    // 向下拖时插到目标后，向上拖时插到目标前，避免“拖了没变化”
    const targetIndexAfterRemove = next.indexOf(targetId)
    if (targetIndexAfterRemove < 0) return
    const insertIndex = dragIndex < targetIndex ? targetIndexAfterRemove + 1 : targetIndexAfterRemove
    next.splice(insertIndex, 0, sourceId)

    const previousItems = items
    const optimisticItems = applySiblingOrder(previousItems, targetParentId, next)
    if (optimisticItems !== previousItems) {
      setItems(optimisticItems)
    }

    try {
      await coreInfoTemplateService.reorder(templateId, {
        parent_id: targetParentId,
        ordered_ids: next,
      })
    } catch (err: unknown) {
      setItems(previousItems)
      toastError(err instanceof Error ? err.message : "排序失败")
    }
  }, [applySiblingOrder, getSiblingIds, items, templateId])

  const handleSortDragEnd = useCallback(async () => {
    const source = sortDraggingRef.current
    const target = sortOverRef.current
    sortDraggingRef.current = null
    sortOverRef.current = null
    setSortDragging(null)
    setSortOver(null)
    if (!source || !target) return
    await handleSortDrop(source.id, source.parentId, target.parentId, target.id)
  }, [handleSortDrop])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="flex flex-col gap-3">
      {/* 添加根节点表单 */}
      {addingRoot && (
        <RowForm
          templateId={templateId}
          parentId={null}
          onDone={() => { setAddingRoot(false); load() }}
          onCancel={() => setAddingRoot(false)}
        />
      )}

      {/* 字段树 */}
      {items.length === 0 && !addingRoot ? (
        <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          暂无字段，点击下方按钮添加字段
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map(node => (
            <TreeNode
              key={node.core_template_id}
              node={node}
              templateId={templateId}
              depth={0}
              onRefresh={load}
              editingNodeId={editingNodeId}
              onStartEdit={(nodeId) => setEditingNodeId(nodeId)}
              onStopEdit={(nodeId) => {
                setEditingNodeId((current) => (current === nodeId ? null : current))
              }}
              enableDrag={enableDrag}
              dependencyMap={dependencyMap}
              sortDragging={sortDragging}
              sortOver={sortOver}
              onSortDragStart={(id, parentId) => {
                const next = { id, parentId }
                sortDraggingRef.current = next
                setSortDragging(next)
                sortOverRef.current = null
                setSortOver(null)
              }}
              onSortDragEnd={handleSortDragEnd}
              onSortDragEnter={(targetId, targetParentId) => {
                const source = sortDraggingRef.current
                if (!source) return
                if (source.parentId !== targetParentId) return
                if (source.id === targetId) return
                const next = { id: targetId, parentId: targetParentId }
                sortOverRef.current = next
                setSortOver(next)
              }}
            />
          ))}
        </div>
      )}

      {/* 底部添加字段按钮 */}
      <button
        onClick={() => setAddingRoot(true)}
        className="h-9 w-full rounded-md border-2 border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-primary/5 transition"
      >
        + 添加字段
      </button>
    </div>
  )
}
