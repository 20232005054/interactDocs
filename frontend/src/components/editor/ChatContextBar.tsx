"use client"

import type { ChatContextItem } from "@/store/chatStore"

interface ChatContextBarProps {
  contextItems: ChatContextItem[]
  onRemoveContext: (contextId: string) => void
  onClearContexts: () => void
}

function getContextMeta(item: ChatContextItem) {
  if (item.kind === "paragraph") {
    const typeLabelMap: Record<string, string> = {
      paragraph: "正文",
      heading1: "一级标题",
      heading2: "二级标题",
      heading3: "三级标题",
    }

    const title = item.chapter_title 
      ? `${item.chapter_title} · ${typeLabelMap[item.para_type ?? "paragraph"]}` 
      : "段落上下文"
    const previewSource = item.selected_text || item.content
    const preview = previewSource.replace(/\s+/g, " ").trim() || "空内容"

    return {
      tag: item.source === "selection" ? "当前操作" : "手动添加",
      title,
      preview,
    }
  }

  return {
    tag: "手动添加",
    title: item.title || "摘要上下文",
    preview: item.content.replace(/\s+/g, " ").trim() || "空内容",
  }
}

export default function ChatContextBar({
  contextItems,
  onRemoveContext,
  onClearContexts,
}: ChatContextBarProps) {
  if (contextItems.length === 0) {
    return null
  }

  return (
    <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
      <div className="min-w-0 flex flex-wrap gap-2">
        {contextItems.map((item) => {
          const meta = getContextMeta(item)
          return (
            <div
              key={item.context_id}
              className="flex max-w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    {meta.tag}
                  </span>
                  <div className="text-[11px] font-medium text-amber-700">{meta.title}</div>
                </div>
                <div className="max-w-[180px] truncate text-[11px] text-amber-900/80">
                  {meta.preview}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveContext(item.context_id)}
                className="shrink-0 text-[11px] text-amber-500 transition hover:text-amber-700"
                title="移除上下文"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onClearContexts}
        className="shrink-0 pt-1 text-[11px] text-gray-400 transition hover:text-gray-600"
      >
        清空上下文
      </button>
    </div>
  )
}
