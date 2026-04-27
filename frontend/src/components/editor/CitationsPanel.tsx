"use client"

import { useCallback, useEffect, useState } from "react"
import { documentService } from "@/services/documentService"
import { cn } from "@/lib/utils"
import type { DocumentCitationItem } from "@/types/api"

interface CitationsPanelProps {
  documentId: string
}

export default function CitationsPanel({ documentId }: CitationsPanelProps) {
  const [citations, setCitations] = useState<DocumentCitationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await documentService.getCitations(documentId)
      setCitations(res.citations)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border p-3 animate-pulse">
            <div className="h-3 bg-muted rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-muted rounded w-1/2 mb-1.5" />
            <div className="h-2.5 bg-muted rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <button onClick={load} className="text-xs text-primary hover:underline">重试</button>
      </div>
    )
  }

  if (citations.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        暂无引用文献
        <p className="text-xs mt-1 text-muted-foreground/70">AI 生成内容后，引用的文献将显示在此处</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* 刷新按钮 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">共 {citations.length} 篇</span>
        <button
          onClick={load}
          className="text-xs text-primary hover:underline"
        >
          刷新
        </button>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {citations.map(c => (
          <CitationCard key={c.citation_number} citation={c} />
        ))}
      </div>
    </div>
  )
}

function CitationCard({ citation: c }: { citation: DocumentCitationItem }) {
  const year = c.publish_date ? new Date(c.publish_date).getFullYear() : null

  return (
    <div className="px-3 py-3 hover:bg-muted/30 transition">
      {/* 编号 + 标题 */}
      <p className="text-xs font-semibold text-foreground leading-snug">
        <span className="text-primary mr-1">[{c.citation_number}]</span>
        {c.title ?? <span className="text-muted-foreground italic">标题未知</span>}
      </p>

      {/* 作者摘要（只显示第一作者 et al.） */}
      {c.authors && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {formatAuthors(c.authors)}
        </p>
      )}

      {/* 期刊 + 年份 */}
      {(c.journal || year) && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {[c.journal, year].filter(Boolean).join(", ")}
        </p>
      )}

      {/* 底部：IF + DOI */}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {c.impact_factor != null && (
          <span className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
            c.impact_factor >= 10
              ? "bg-red-50 text-red-600"
              : c.impact_factor >= 5
                ? "bg-orange-50 text-orange-600"
                : "bg-blue-50 text-blue-600"
          )}>
            IF: {c.impact_factor.toFixed(1)}
          </span>
        )}
        {c.doi && (
          <a
            href={`https://doi.org/${c.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-primary hover:underline truncate max-w-[160px]"
            title={c.doi}
          >
            doi: {c.doi}
          </a>
        )}
      </div>
    </div>
  )
}

/** 只显示第一作者，多人时加 et al. */
function formatAuthors(authors: string): string {
  const parts = authors.split(",").map(s => s.trim()).filter(Boolean)
  if (parts.length <= 1) return authors
  return `${parts[0]} et al.`
}
