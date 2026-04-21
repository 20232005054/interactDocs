"use client"

import { useRef, useState } from "react"
import { summaryService } from "@/services/summaryService"
import { useDocumentStore } from "@/store/documentStore"
import type { Summary } from "@/types/api"
import { cn } from "@/lib/utils"

// ----------------------------------------------------------------
// 单条摘要卡片
// ----------------------------------------------------------------
interface SummaryCardProps {
  summary: Summary
}

function SummaryCard({ summary }: SummaryCardProps) {
  const { updateSummary } = useDocumentStore()
  const [localContent, setLocalContent] = useState(summary.content)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (val: string) => {
    setLocalContent(val)
    updateSummary(summary.summary_id, { content: val })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await summaryService.update(summary.summary_id, { content: val })
      } finally {
        setSaving(false)
      }
    }, 600)
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

        {saving && (
          <span className="shrink-0 text-xs text-gray-300">…</span>
        )}
      </div>

      {/* 内容编辑区 */}
      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            value={localContent}
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

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function SummaryPanel() {
  const { summaries } = useDocumentStore()

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
      {/* 变更提示 */}
      {changedCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-orange-50 border border-orange-200">
          <span className="text-xs text-orange-500">
            {changedCount} 条摘要已变更，请检查并更新内容
          </span>
        </div>
      )}

      {summaries
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(s => (
          <SummaryCard key={s.summary_id} summary={s} />
        ))}
    </div>
  )
}
