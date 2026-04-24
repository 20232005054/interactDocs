"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { summaryService } from "@/services/summaryService"
import { useDocumentStore } from "@/store/documentStore"
import type { Summary } from "@/types/api"
import { cn } from "@/lib/utils"

// ----------------------------------------------------------------
// 单条摘要卡片
// ----------------------------------------------------------------
interface SummaryCardProps {
  summary: Summary
  onChangeContent: (summaryId: string, content: string) => void
}

function SummaryCard({ summary, onChangeContent }: SummaryCardProps) {
  const [expanded, setExpanded] = useState(true)

  const handleChange = (val: string) => {
    onChangeContent(summary.summary_id, val)
  }

  const isChanged = summary.is_change === 1

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-colors",
      isChanged ? "border-orange-300 bg-orange-50/30" : "border-gray-200 bg-white"
    )}>
      {/* 卡片头部 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <button
          type="button"
          className={cn(
            "w-3.5 h-3.5 flex items-center justify-center text-gray-400 shrink-0 transition-transform text-xs",
            !expanded && "-rotate-90"
          )}
        >
          ▾
        </button>

        <span className={cn(
          "flex-1 text-xs font-medium truncate",
          isChanged ? "text-orange-600" : "text-gray-700"
        )}>
          {summary.title}
        </span>

        {/* 变更标记 */}
        {isChanged && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-500">
            已变更
          </span>
        )}

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
  )
}

interface SummaryPanelProps {
  onAfterSave?: () => Promise<void>
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function SummaryPanel({ onAfterSave }: SummaryPanelProps) {
  const { summaries, updateSummary } = useDocumentStore()
  const [originalContentMap, setOriginalContentMap] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const orderedSummaries = useMemo(
    () => summaries.slice().sort((a, b) => a.order_index - b.order_index),
    [summaries]
  )

  useEffect(() => {
    if (orderedSummaries.length === 0) {
      setOriginalContentMap({})
      setDirtyIds(new Set())
      return
    }

    setOriginalContentMap((prev) => {
      const next = { ...prev }
      const liveIds = new Set(orderedSummaries.map((summary) => summary.summary_id))

      orderedSummaries.forEach((summary) => {
        if (!(summary.summary_id in next)) {
          next[summary.summary_id] = summary.content ?? ""
        }
      })

      Object.keys(next).forEach((id) => {
        if (!liveIds.has(id)) delete next[id]
      })

      return next
    })
  }, [orderedSummaries])

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

  const handleSave = useCallback(async () => {
    if (dirtyIds.size === 0 || saving) return

    const contentMap = new Map(orderedSummaries.map((summary) => [summary.summary_id, summary.content ?? ""]))
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
      alert(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [dirtyIds, onAfterSave, orderedSummaries, saving])

  if (summaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-400">
        暂无摘要
      </div>
    )
  }

  const changedCount = summaries.filter(s => s.is_change === 1).length

  return (
    <div className="px-3 py-3 flex flex-col gap-2">
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

      {orderedSummaries.map(s => (
          <SummaryCard
            key={s.summary_id}
            summary={s}
            onChangeContent={handleSummaryContentChange}
          />
        ))}
    </div>
  )
}
