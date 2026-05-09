"use client"

import type { SourceInfo } from "@/types/api"
import { X } from "lucide-react"

const SOURCE_TYPE_LABELS: Record<string, string> = {
  keyinfo: "核心信息",
  summary: "摘要",
  chapter: "章节",
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  keyinfo_match: "核心信息匹配",
  keyinfo_group_match: "核心信息分组匹配",
  summary_match: "摘要匹配",
  chapter_match: "章节匹配",
}

interface ReadonlySourceListProps {
  sources: SourceInfo[]
  emptyHint?: string
  onRemove?: (sourceIndex: number) => void
  editable?: boolean
}

function isPlainKeyInfoSource(source: SourceInfo): boolean {
  return source.source.value === "keyinfo" && source.match_type !== "keyinfo_group_match"
}

function dedupeMatchKeys(keys: SourceInfo["match_keys"]): SourceInfo["match_keys"] {
  const map = new Map<string, SourceInfo["match_keys"][number]>()
  for (const key of keys) {
    if (!map.has(key.value)) {
      map.set(key.value, key)
    }
  }
  return Array.from(map.values())
}

function mergeKeyInfoSourcesForDisplay(sources: SourceInfo[]): SourceInfo[] {
  const firstPlainKeyInfoIndex = sources.findIndex(isPlainKeyInfoSource)
  if (firstPlainKeyInfoIndex < 0) return sources

  const plainKeyInfoSources = sources.filter(isPlainKeyInfoSource)
  if (plainKeyInfoSources.length <= 1) return sources

  const first = plainKeyInfoSources[0]
  const merged: SourceInfo = {
    ...first,
    source: {
      ...first.source,
      value: "keyinfo",
      label: "核心信息",
    },
    match_type: "keyinfo_match",
    match_keys: dedupeMatchKeys(
      plainKeyInfoSources.flatMap((item) => item.match_keys ?? [])
    ),
    target_field: first.target_field || "",
  }

  const next: SourceInfo[] = []
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    if (!isPlainKeyInfoSource(source)) {
      next.push(source)
      continue
    }

    if (index === firstPlainKeyInfoIndex) {
      next.push(merged)
    }
  }

  return next
}

export default function ReadonlySourceList({
  sources,
  emptyHint = "拖拽核心信息字段到编辑区后，这里的来源映射会自动更新。",
  onRemove,
  editable = false,
}: ReadonlySourceListProps) {
  const displaySources = mergeKeyInfoSourcesForDisplay(sources)

  if (sources.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
        {emptyHint}
      </div>
    )
  }

  const tokens: Array<{
    id: string
    label: string
    tone: "keyinfo" | "group" | "other"
    children?: SourceInfo["match_keys"]
    sourceIndex: number
  }> = []

  displaySources.forEach((source, sourceIndex) => {
    const isGroupSource = source.match_type === "keyinfo_group_match"
    if (isGroupSource) {
      tokens.push({
        id: `group-${source.target_field || sourceIndex}`,
        label: source.source.label || source.target_field || "分组",
        tone: "group",
        children: source.match_keys,
        sourceIndex,
      })
      return
    }

    if (source.match_keys.length > 0) {
      source.match_keys.forEach((key, keyIndex) => {
        tokens.push({
          id: `${source.source.value}-${source.match_type}-${key.value}-${sourceIndex}-${keyIndex}`,
          label: key.label,
          tone: source.source.value === "keyinfo" ? "keyinfo" : "other",
          sourceIndex,
        })
      })
      return
    }

    tokens.push({
      id: `${source.source.value}-${source.match_type}-empty-${sourceIndex}`,
      label: "暂无匹配字段",
      tone: "other",
      sourceIndex,
    })
  })

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        {tokens.map((token) => {
          if (token.tone === "group") {
            return (
              <div key={token.id} className="group/readonly-group relative inline-flex">
                <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-800">
                  {token.label}
                  {editable && onRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(token.sourceIndex)
                      }}
                      className="inline-flex h-3 w-3 items-center justify-center rounded-full hover:bg-indigo-200 transition"
                      title="删除来源"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
                <div className="absolute left-0 top-full z-20 hidden min-w-56 max-w-80 rounded-md border border-gray-200 bg-white p-2 shadow-md group-hover/readonly-group:block">
                  <div className="mb-1 text-[11px] font-medium text-gray-500">
                    {token.label} · 子字段
                  </div>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {token.children && token.children.length > 0 ? (
                      token.children.map((key, keyIndex) => (
                        <span
                          key={`${token.id}-${key.value}-${keyIndex}`}
                          className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"
                        >
                          {key.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-gray-400">该分组下暂无可用子字段</span>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          if (token.tone === "keyinfo") {
            return (
              <span
                key={token.id}
                className="inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800"
              >
                {token.label}
                {editable && onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(token.sourceIndex)
                    }}
                    className="inline-flex h-3 w-3 items-center justify-center rounded-full hover:bg-yellow-200 transition"
                    title="删除来源"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            )
          }

          return (
            <span
              key={token.id}
              className="inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
            >
              {token.label}
              {editable && onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(token.sourceIndex)
                  }}
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full hover:bg-gray-300 transition"
                  title="删除来源"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
