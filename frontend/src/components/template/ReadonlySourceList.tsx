"use client"

import type { SourceInfo } from "@/types/api"

const SOURCE_TYPE_LABELS: Record<string, string> = {
  keyinfo: "核心信息",
  summary: "摘要",
  chapter: "章节",
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  keyinfo_match: "核心信息匹配",
  summary_match: "摘要匹配",
  chapter_match: "章节匹配",
}

interface ReadonlySourceListProps {
  sources: SourceInfo[]
  emptyHint?: string
}

export default function ReadonlySourceList({
  sources,
  emptyHint = "拖拽核心信息字段到编辑区后，这里的来源映射会自动更新。",
}: ReadonlySourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
        {emptyHint}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sources.map((source, index) => {
        const sourceLabel = SOURCE_TYPE_LABELS[source.source.value] ?? source.source.label ?? source.source.value
        const matchTypeLabel = MATCH_TYPE_LABELS[source.match_type] ?? source.match_type

        return (
          <div
            key={`${source.source.value}-${source.match_type}-${index}`}
            className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
              <span className="rounded-full bg-white px-1.5 py-0.5 font-medium text-gray-700">
                {sourceLabel}
              </span>
              <span>匹配方式：{matchTypeLabel}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {source.match_keys.length > 0 ? (
                source.match_keys.map((key) => (
                  <span
                    key={key.value}
                    className="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800"
                  >
                    {key.label}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-gray-400">暂无匹配字段</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
