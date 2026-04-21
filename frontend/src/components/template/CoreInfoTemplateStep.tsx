"use client"

import { useEffect, useState, useCallback } from "react"
import { coreInfoTemplateService } from "@/services/templateService"
import type { CoreInfoTemplate, FieldType } from "@/types/api"
import { cn } from "@/lib/utils"
import { setCoreInfoDragData } from "@/lib/templateDrag"

interface CoreInfoTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
  enableDrag?: boolean
}

// ----------------------------------------------------------------
// 单行编辑表单（内联）
// ----------------------------------------------------------------
interface RowFormProps {
  templateId: string
  parentId: string | null
  initial?: CoreInfoTemplate
  onDone: () => void
  onCancel: () => void
}

function RowForm({ templateId, parentId, initial, onDone, onCancel }: RowFormProps) {
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

      {fieldType === "number" && (
        <input
          type="number"
          value={defaultValue}
          onChange={e => setDefaultValue(e.target.value)}
          placeholder="默认数值（可选）"
          className="h-8 rounded border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring w-40"
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
  enableDrag: boolean
}

function TreeNode({ node, templateId, depth, onRefresh, enableDrag }: TreeNodeProps) {
  const [editing, setEditing] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    try {
      await coreInfoTemplateService.delete(node.core_template_id)
      onRefresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const fieldTypeLabel: Record<FieldType, string> = {
    text: "文本",
    number: "数值",
    select: "下拉",
    group: "分组",
  }

  return (
    <div className={cn("flex flex-col gap-1", depth > 0 && "ml-6 border-l border-border pl-3")}>
      {editing ? (
        <RowForm
          templateId={templateId}
          parentId={node.parent_id}
          initial={node}
          onDone={() => { setEditing(false); onRefresh() }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/40 group">
          {enableDrag && node.field_type !== "group" && (
            <button
              type="button"
              draggable
              onDragStart={(event) =>
                setCoreInfoDragData(event, { fieldKey: node.field_key, label: node.field_name })
              }
              className="h-6 shrink-0 rounded border border-dashed border-green-300 px-2 text-[11px] font-medium text-green-700 cursor-grab active:cursor-grabbing"
              title="拖拽到摘要模板或章节结构模板中自动填入"
            >
              拖拽
            </button>
          )}
          <span className="text-sm font-medium text-foreground flex-1">{node.field_name}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {fieldTypeLabel[node.field_type]}
          </span>
          {node.is_required && (
            <span className="text-xs text-destructive">必填</span>
          )}
          {node.default_value && (
            <span className="text-xs text-muted-foreground truncate max-w-24">默认: {node.default_value}</span>
          )}

          {/* 操作按钮（hover 显示） */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {node.field_type === "group" && (
              <button
                onClick={() => setAddingChild(true)}
                className="text-xs text-primary hover:underline"
              >
                + 子字段
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              编辑
            </button>
            {deleting ? (
              <>
                <button onClick={handleDelete} className="text-xs text-destructive hover:underline">确认</button>
                <button onClick={() => setDeleting(false)} className="text-xs text-muted-foreground hover:underline">取消</button>
              </>
            ) : (
              <button onClick={() => setDeleting(true)} className="text-xs text-muted-foreground hover:text-destructive">删除</button>
            )}
          </div>
        </div>
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
      {node.children?.map(child => (
        <TreeNode
          key={child.core_template_id}
          node={child}
          templateId={templateId}
          depth={depth + 1}
          onRefresh={onRefresh}
          enableDrag={enableDrag}
        />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function CoreInfoTemplateStep({ templateId, onCountChange, enableDrag = false }: CoreInfoTemplateStepProps) {
  const [items, setItems] = useState<CoreInfoTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingRoot, setAddingRoot] = useState(false)

  const countAll = useCallback((nodes: CoreInfoTemplate[]): number =>
    nodes.reduce((acc, n) => acc + 1 + countAll(n.children ?? []), 0), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await coreInfoTemplateService.getByTemplate(templateId)
      setItems(res.items ?? [])
      onCountChange?.(countAll(res.items ?? []))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange, countAll])

  useEffect(() => { load() }, [load])

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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">核心信息字段</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {enableDrag
              ? "定义核心信息结构，并可将字段拖到摘要模板或章节结构模板中自动填入"
              : "定义文档的核心信息结构，支持文本、下拉选择和分组类型"}
          </p>
        </div>
        <button
          onClick={() => setAddingRoot(true)}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
        >
          + 添加字段
        </button>
      </div>

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
          暂无字段，点击添加字段开始配置
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
              enableDrag={enableDrag}
            />
          ))}
        </div>
      )}
    </div>
  )
}
