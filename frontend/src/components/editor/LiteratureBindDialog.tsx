"use client"

import { useCallback, useEffect, useState } from "react"
import { literatureService } from "@/services/literatureService"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { Literature } from "@/types/api"

interface LiteratureBindDialogProps {
  paragraphId: string
  boundLiteratureIds: string[]
  onClose: () => void
  onBound: (lit: Literature) => void
}

export default function LiteratureBindDialog({
  paragraphId,
  boundLiteratureIds,
  onClose,
  onBound,
}: LiteratureBindDialogProps) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<Literature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [scopeFilter, setScopeFilter] = useState<"" | "public" | "private">("")
  const [binding, setBinding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await literatureService.list(scopeFilter || undefined)
      setItems(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [scopeFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleBind = async (lit: Literature) => {
    setBinding(lit.literature_id)
    setError(null)
    try {
      await literatureService.bindToParagraph(paragraphId, lit.literature_id)
      onBound(lit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "绑定失败")
      setBinding(null)
    }
  }

  const filtered = items.filter((i) => {
    // 过滤已绑定的文献
    if (boundLiteratureIds.includes(i.literature_id)) return false
    // 过滤他人的 private 文献
    if (i.scope === "private" && i.user_id !== user?.user_id) return false
    // 只显示 ready 状态的文献
    if (i.upload_status !== "ready") return false
    // 关键字搜索
    if (!keyword.trim()) return true
    const kw = keyword.toLowerCase()
    return (
      i.title?.toLowerCase().includes(kw) ||
      i.authors?.toLowerCase().includes(kw) ||
      i.doi?.toLowerCase().includes(kw) ||
      i.journal?.toLowerCase().includes(kw)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">绑定文献到段落</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {/* 筛选栏 */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题、作者、DOI、期刊..."
            className="h-8 flex-1 rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
          />
          <div className="flex items-center rounded border border-gray-300 overflow-hidden text-xs">
            {(["", "public", "private"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScopeFilter(s)}
                className={cn(
                  "px-3 h-8 transition",
                  scopeFilter === s ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "" ? "全部" : s === "public" ? "公共" : "私有"}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} 篇</span>
        </div>

        {/* 文献列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && (
            <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <button onClick={load} className="text-xs text-blue-500 hover:underline">
                重试
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              {keyword.trim() ? "未找到匹配的文献" : "暂无可绑定的文献"}
              <p className="text-xs text-gray-300 mt-1">
                {boundLiteratureIds.length > 0 ? "已绑定的文献已自动过滤" : "请先上传文献到知识库"}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-2">
              {filtered.map((lit) => (
                <LiteratureCard
                  key={lit.literature_id}
                  literature={lit}
                  binding={binding === lit.literature_id}
                  onBind={() => handleBind(lit)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 文献卡片
// ----------------------------------------------------------------
interface LiteratureCardProps {
  literature: Literature
  binding: boolean
  onBind: () => void
}

function LiteratureCard({ literature: lit, binding, onBind }: LiteratureCardProps) {
  const year = lit.publish_date ? new Date(lit.publish_date).getFullYear() : null

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition">
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <p className="text-sm font-medium text-gray-800 leading-snug mb-1">
          {lit.title ?? <span className="text-gray-400 italic">标题未知</span>}
        </p>

        {/* 作者 */}
        {lit.authors && (
          <p className="text-xs text-gray-500 mb-0.5 truncate">{formatAuthors(lit.authors)}</p>
        )}

        {/* 期刊 + 年份 */}
        {(lit.journal || year) && (
          <p className="text-xs text-gray-500 mb-1">
            {[lit.journal, year].filter(Boolean).join(", ")}
          </p>
        )}

        {/* 底部标签 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 处理模式 */}
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              lit.processing_mode === "fast"
                ? "bg-green-50 text-green-600"
                : "bg-blue-50 text-blue-600"
            )}
          >
            {lit.processing_mode === "fast" ? "快速" : "完整"}
          </span>

          {/* 分块数 */}
          <span className="text-[10px] text-gray-400">
            {lit.chunk_count} 个分块
          </span>

          {/* IF */}
          {lit.impact_factor != null && (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                lit.impact_factor >= 10
                  ? "bg-red-50 text-red-600"
                  : lit.impact_factor >= 5
                  ? "bg-orange-50 text-orange-600"
                  : "bg-blue-50 text-blue-600"
              )}
            >
              IF: {lit.impact_factor.toFixed(1)}
            </span>
          )}

          {/* Scope */}
          {lit.scope === "private" && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
              私有
            </span>
          )}

          {/* DOI */}
          {lit.doi && (
            <a
              href={`https://doi.org/${lit.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px]"
              title={lit.doi}
              onClick={(e) => e.stopPropagation()}
            >
              {lit.doi}
            </a>
          )}
        </div>
      </div>

      {/* 绑定按钮 */}
      <button
        onClick={onBind}
        disabled={binding}
        className="shrink-0 h-7 px-3 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition"
      >
        {binding ? "绑定中..." : "绑定"}
      </button>
    </div>
  )
}

/** 只显示第一作者，多人时加 et al. */
function formatAuthors(authors: string): string {
  const parts = authors.split(",").map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return authors
  return `${parts[0]} et al.`
}
