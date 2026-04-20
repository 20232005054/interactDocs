"use client"

import { useRef, useState } from "react"
import { summaryService } from "@/services/summaryService"
import { useDocumentStore } from "@/store/documentStore"
import type { Summary } from "@/types/api"
import { cn } from "@/lib/utils"

interface SummaryPanelProps {
  documentId: string
}

// ----------------------------------------------------------------
// 单条摘要卡片
// ----------------------------------------------------------------
interface SummaryCardProps {
  summary: Summary
  onReload: () => void
}

function SummaryCard({ summary, onReload }: SummaryCardProps) {
  const { updateSummary } = useDocumentStore()
  const [localContent, setLocalContent] = useState(summary.content)
  const [localTitle, setLocalTitle] = useState(summary.title)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPreview, setAiPreview] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isChanged = summary.is_change === 1

  const handleContentChange = (val: string) => {
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

  const handleTitleChange = (val: string) => {
    setLocalTitle(val)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      try {
        await summaryService.update(summary.summary_id, { title: val })
        updateSummary(summary.summary_id, { title: val })
      } catch {
        // 静默失败
      }
    }, 600)
  }

  const handleAIAssist = async () => {
    setAiLoading(true)
    setAiPreview(null)
    try {
      const res = await summaryService.aiAssist(summary.summary_id)
      setAiPreview(res.ai_generate)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "AI 帮填失败")
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyAI = async () => {
    try {
      const updated = await summaryService.applyAI(summary.summary_id)
      setLocalContent(updated.content)
      updateSummary(summary.summary_id, { content: updated.content, is_change: updated.is_change })
      setAiPreview(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "应用失败")
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确认删除摘要「${summary.title}」？`)) return
    setDeleting(true)
    try {
      await summaryService.delete(summary.summary_id)
      onReload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-colors",
      isChanged ? "border-orange-300 bg-orange-50/30" : "border-gray-200 bg-white"
    )}>
      {/* 卡片头部 */}
      <div className="flex items-center gap-2 px-3 py-2">
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

        {/* 标题（双击编辑） */}
        {editingTitle ? (
          <input
            autoFocus
            value={localTitle}
            onChange={e => handleTitleChange(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
            className="flex-1 text-xs border-b border-blue-300 outline-none bg-transparent font-medium"
          />
        ) : (
          <span
            onDoubleClick={() => setEditingTitle(true)}
            className={cn(
              "flex-1 text-xs font-medium truncate cursor-default",
              isChanged ? "text-orange-600" : "text-gray-700"
            )}
            title={localTitle}
          >
            {localTitle}
          </span>
        )}

        {isChanged && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-500">
            已变更
          </span>
        )}
        {saving && <span className="shrink-0 text-xs text-gray-300">…</span>}

        {/* 删除按钮 */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition text-xs rounded"
          title="删除摘要"
        >
          ×
        </button>
      </div>

      {/* 内容编辑区 */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <textarea
            value={localContent}
            onChange={e => handleContentChange(e.target.value)}
            rows={4}
            className={cn(
              "w-full resize-none rounded border px-2 py-1.5 text-xs outline-none leading-relaxed transition",
              isChanged
                ? "border-orange-200 bg-orange-50/50 focus:border-orange-300"
                : "border-gray-200 bg-gray-50 focus:border-blue-300 focus:bg-white"
            )}
            placeholder="摘要内容..."
          />

          {/* AI 帮填预览 */}
          {aiPreview !== null && (
            <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-gray-700 leading-relaxed">
              <div className="text-xs text-blue-500 mb-1 font-medium">AI 生成预览</div>
              <p className="whitespace-pre-wrap">{aiPreview}</p>
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={handleApplyAI}
                  className="h-6 px-2 rounded text-xs bg-green-500 text-white hover:bg-green-600 transition"
                >
                  应用
                </button>
                <button
                  type="button"
                  onClick={() => setAiPreview(null)}
                  className="h-6 px-2 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                >
                  丢弃
                </button>
              </div>
            </div>
          )}

          {/* 底部操作行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAIAssist}
                disabled={aiLoading}
                className="h-6 px-2 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
              >
                {aiLoading ? "生成中..." : "AI 帮填"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">v{summary.version}</span>
              <span className="text-xs text-gray-300">
                {new Date(summary.updated_at).toLocaleDateString("zh-CN", {
                  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function SummaryPanel({ documentId }: SummaryPanelProps) {
  const { summaries, setSummaries } = useDocumentStore()
  const [adding, setAdding] = useState(false)

  const reload = async () => {
    try {
      const res = await summaryService.getByDocument(documentId)
      setSummaries(res.summaries)
    } catch {
      // 静默失败
    }
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      await summaryService.create(documentId)
      await reload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "新增失败")
    } finally {
      setAdding(false)
    }
  }

  const changedCount = summaries.filter(s => s.is_change === 1).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {changedCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-orange-50 border border-orange-200">
            <span className="text-xs text-orange-500">
              {changedCount} 条摘要已变更，请检查并更新内容
            </span>
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-gray-400">
            暂无摘要
          </div>
        ) : (
          summaries
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map(s => (
              <SummaryCard key={s.summary_id} summary={s} onReload={reload} />
            ))
        )}
      </div>

      {/* 底部新增按钮 */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="w-full h-7 rounded border border-dashed border-gray-300 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition disabled:opacity-50"
        >
          {adding ? "添加中..." : "+ 添加摘要"}
        </button>
      </div>
    </div>
  )
}
