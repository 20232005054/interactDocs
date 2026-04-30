"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"
import { summaryService } from "@/services/summaryService"
import { useDocumentStore } from "@/store/documentStore"
import type { Summary } from "@/types/api"
import { cn } from "@/lib/utils"
import { toastError, toastSuccess } from "@/hooks/useToast"
import ConfirmDialog from "@/components/ui/ConfirmDialog"

// ----------------------------------------------------------------
// 可拖拽的摘要卡片
// ----------------------------------------------------------------
interface SortableSummaryCardProps {
  summary: Summary
  onChangeContent: (summaryId: string, content: string) => void
  onDelete: (summaryId: string) => void
}

function SortableSummaryCard({ summary, onChangeContent, onDelete }: SortableSummaryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: summary.summary_id })

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
      <SummaryCard
        summary={summary}
        onChangeContent={onChangeContent}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// 单条摘要卡片
// ----------------------------------------------------------------
interface SummaryCardProps {
  summary: Summary
  onChangeContent: (summaryId: string, content: string) => void
  onDelete: (summaryId: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function SummaryCard({ summary, onChangeContent, onDelete, dragHandleProps }: SummaryCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleChange = (val: string) => {
    onChangeContent(summary.summary_id, val)
  }

  const isChanged = summary.is_change === 1

  return (
    <>
      <div className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isChanged ? "border-orange-300 bg-orange-50/30" : "border-gray-200 bg-white"
      )}>
        {/* 卡片头部 */}
        <div className="flex items-center gap-2 px-3 py-2 group">
          {/* 拖拽手柄 */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing shrink-0"
              title="拖动排序"
            >
              <GripVertical className="w-4 h-4 text-gray-300 hover:text-gray-500" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={cn(
              "w-3.5 h-3.5 flex items-center justify-center text-gray-400 shrink-0 transition-transform text-xs",
              !expanded && "-rotate-90"
            )}
          >
            ▾
          </button>

          <span className={cn(
            "flex-1 text-xs font-medium truncate cursor-pointer",
            isChanged ? "text-orange-600" : "text-gray-700"
          )}
          onClick={() => setExpanded(v => !v)}
          >
            {summary.title}
          </span>

          {/* 变更标记 */}
          {isChanged && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-500">
              已变更
            </span>
          )}

          {/* 删除按钮 */}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition"
            title="删除摘要"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" />
          </button>

        </div>

        {/* 内容编辑区 */}
        {expanded && (
          <div className="px-3 pb-3">
            <textarea
              value={summary.content}
              onChange={e => handleChange(e.target.value)}
              rows={4}
              className={cn(
                "w-full resize-none rounded border px-2 py-1.5 text-xs outline-none leading-relaxed transition",
                isChanged
                  ? "border-orange-200 bg-orange-50/50 focus:border-orange-300"
                  : "border-gray-200 bg-gray-50 focus:border-blue-300 focus:bg-white"
              )}
              placeholder="摘要内容..."
            />
            {/* 版本信息 */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-300">v{summary.version}</span>
              <span className="text-xs text-gray-300">
                {new Date(summary.updated_at).toLocaleDateString("zh-CN", {
                  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={confirmDelete}
        title={`删除摘要「${summary.title}」？`}
        description="此操作不可撤销，摘要内容将被永久删除。"
        confirmLabel="删除"
        destructive
        onConfirm={() => {
          onDelete(summary.summary_id)
          setConfirmDelete(false)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

interface SummaryPanelProps {
  onAfterSave?: () => Promise<void>
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function SummaryPanel({ onAfterSave }: SummaryPanelProps) {
  const { summaries, updateSummary, documentId } = useDocumentStore()
  const [originalContentMap, setOriginalContentMap] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [localSummaries, setLocalSummaries] = useState<Summary[]>([])

  const orderedSummaries = useMemo(
    () => summaries.slice().sort((a, b) => a.order_index - b.order_index),
    [summaries]
  )

  // 初始化本地排序状态
  useEffect(() => {
    setLocalSummaries(orderedSummaries)
  }, [orderedSummaries])

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 拖拽结束处理
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setLocalSummaries((items) => {
      const oldIndex = items.findIndex((item) => item.summary_id === active.id)
      const newIndex = items.findIndex((item) => item.summary_id === over.id)

      if (oldIndex === -1 || newIndex === -1) return items

      const newItems = arrayMove(items, oldIndex, newIndex)

      // 调用后端 reorder 接口
      if (documentId) {
        const orderedIds = newItems.map((item) => item.summary_id)
        summaryService.reorder(documentId, orderedIds).catch((err) => {
          toastError(err instanceof Error ? err.message : "排序失败")
          // 失败时恢复原顺序
          setLocalSummaries(items)
        })
      }

      return newItems
    })
  }, [documentId])

  useEffect(() => {
    if (localSummaries.length === 0) {
      setOriginalContentMap({})
      setDirtyIds(new Set())
      return
    }

    setOriginalContentMap((prev) => {
      const next = { ...prev }
      const liveIds = new Set(localSummaries.map((summary) => summary.summary_id))

      localSummaries.forEach((summary) => {
        if (!(summary.summary_id in next)) {
          next[summary.summary_id] = summary.content ?? ""
        }
      })

      Object.keys(next).forEach((id) => {
        if (!liveIds.has(id)) delete next[id]
      })

      return next
    })
  }, [localSummaries])

  const handleSummaryContentChange = useCallback((summaryId: string, content: string) => {
    updateSummary(summaryId, { content })
    setDirtyIds((prev) => {
      const next = new Set(prev)
      const baseline = originalContentMap[summaryId] ?? ""
      if ((content ?? "") === baseline) {
        next.delete(summaryId)
      } else {
        next.add(summaryId)
      }
      return next
    })
  }, [originalContentMap, updateSummary])

  const handleDelete = useCallback(async (summaryId: string) => {
    try {
      await summaryService.delete(summaryId)
      toastSuccess("摘要已删除")
      // 从本地状态中移除
      setLocalSummaries((prev) => prev.filter((s) => s.summary_id !== summaryId))
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (dirtyIds.size === 0 || saving) return

    const contentMap = new Map(localSummaries.map((summary) => [summary.summary_id, summary.content ?? ""]))
    const payload = Array.from(dirtyIds).map((id) => ({
      id,
      content: contentMap.get(id) ?? "",
    }))

    setSaving(true)
    try {
      await Promise.all(
        payload.map((item) => summaryService.update(item.id, { content: item.content }))
      )

      setOriginalContentMap((prev) => {
        const next = { ...prev }
        payload.forEach((item) => {
          next[item.id] = item.content
        })
        return next
      })
      setDirtyIds(new Set())

      if (onAfterSave) {
        await onAfterSave()
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [dirtyIds, onAfterSave, localSummaries, saving])

  if (summaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400">
        暂无摘要
      </div>
    )
  }

  const changedCount = summaries.filter(s => s.is_change === 1).length

  return (
    <div className="px-6 py-6 flex flex-col gap-4">
      {dirtyIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5">
          <span className="text-xs text-blue-700">有 {dirtyIds.size} 条摘要待保存</span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-7 rounded border border-blue-300 px-2.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}
      {/* 变更提示 */}
      {changedCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-orange-50 border border-orange-200">
          <span className="text-xs text-orange-500">
            {changedCount} 条摘要已变更，请检查并更新内容
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localSummaries.map((s) => s.summary_id)}
          strategy={verticalListSortingStrategy}
        >
          {localSummaries.map(s => (
            <SortableSummaryCard
              key={s.summary_id}
              summary={s}
              onChangeContent={handleSummaryContentChange}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
