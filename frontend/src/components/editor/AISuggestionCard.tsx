"use client"

import { useState } from "react"
import { FileText, FileEdit, Edit3, Plus, Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AISuggestion } from "@/types/ai-suggestions"

interface AISuggestionCardProps {
  suggestion: AISuggestion
  onApply: (suggestion: AISuggestion) => Promise<void>
  onReject: (suggestion: AISuggestion) => void
}

export default function AISuggestionCard({
  suggestion,
  onApply,
  onReject,
}: AISuggestionCardProps) {
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApply(suggestion)
    } finally {
      setApplying(false)
    }
  }

  // 根据状态判断是否显示操作按钮
  const showActions = suggestion.status === "pending"
  const isApplied = suggestion.status === "applied"
  const isRejected = suggestion.status === "rejected"

  // 根据类型返回图标和主题色
  const getTypeConfig = () => {
    switch (suggestion.type) {
      case "create_chapter":
        return {
          icon: FileText,
          label: "创建章节",
          color: "blue",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-700",
          iconColor: "text-blue-500",
        }
      case "create_paragraph":
        return {
          icon: FileEdit,
          label: "创建段落",
          color: "blue",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-700",
          iconColor: "text-blue-500",
        }
      case "edit_content":
        return {
          icon: Edit3,
          label: "修改建议",
          color: "amber",
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          textColor: "text-amber-700",
          iconColor: "text-amber-500",
        }
      case "insert_text":
        return {
          icon: Plus,
          label: "插入文本",
          color: "green",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-700",
          iconColor: "text-green-500",
        }
    }
  }

  const config = getTypeConfig()
  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-200",
        isApplied && "bg-gray-50 border-gray-200 opacity-75",
        isRejected && "bg-gray-50 border-gray-200 opacity-50",
        showActions && config.bgColor,
        showActions && config.borderColor,
        "animate-in fade-in slide-in-from-bottom-2"
      )}
    >
      {/* 头部：类型标签 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", showActions ? config.iconColor : "text-gray-400")} />
          <span className={cn("text-xs font-medium", showActions ? config.textColor : "text-gray-500")}>
            {config.label}
          </span>
        </div>
        {isApplied && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            已应用
          </span>
        )}
        {isRejected && (
          <span className="text-xs text-gray-400">已忽略</span>
        )}
      </div>

      {/* 内容区域 */}
      <div className="mb-3">
        {suggestion.type === "create_chapter" && (
          <CreateChapterContent suggestion={suggestion} />
        )}
        {suggestion.type === "create_paragraph" && (
          <CreateParagraphContent suggestion={suggestion} />
        )}
        {suggestion.type === "edit_content" && (
          <EditContentContent suggestion={suggestion} />
        )}
        {suggestion.type === "insert_text" && (
          <InsertTextContent suggestion={suggestion} />
        )}
      </div>

      {/* 操作按钮 */}
      {showActions && (
        <div className="flex items-center gap-2 animate-in fade-in duration-200">
          <button
            onClick={handleApply}
            disabled={applying}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
              "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md disabled:opacity-50 active:scale-95"
            )}
          >
            {applying ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                应用中...
              </>
            ) : (
              <>
                <Check className="w-3 h-3" />
                应用
              </>
            )}
          </button>
          <button
            onClick={() => onReject(suggestion)}
            disabled={applying}
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 active:scale-95"
          >
            忽略
          </button>
        </div>
      )}
    </div>
  )
}

// 创建章节内容
function CreateChapterContent({ suggestion }: { suggestion: AISuggestion & { type: "create_chapter" } }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-gray-800">
        标题：{suggestion.title}
      </div>
      <div className="text-xs text-gray-600">
        位置：{suggestion.parent_id ? "子章节" : "根章节"}
      </div>
      {suggestion.description && (
        <div className="text-xs text-gray-500 mt-1">
          {suggestion.description}
        </div>
      )}
    </div>
  )
}

// 创建段落内容
function CreateParagraphContent({ suggestion }: { suggestion: AISuggestion & { type: "create_paragraph" } }) {
  const typeLabels: Record<string, string> = {
    paragraph: "正文",
    heading1: "一级标题",
    heading2: "二级标题",
    heading3: "三级标题",
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-gray-600">
        类型：{typeLabels[suggestion.para_type] || suggestion.para_type}
      </div>
      <div className="text-xs text-gray-700 bg-white rounded p-2 border border-gray-100 max-h-32 overflow-y-auto">
        {suggestion.content}
      </div>
      {suggestion.description && (
        <div className="text-xs text-gray-500">
          {suggestion.description}
        </div>
      )}
    </div>
  )
}

// 修改内容
function EditContentContent({ suggestion }: { suggestion: AISuggestion & { type: "edit_content" } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-600">
        目标：{suggestion.target_type === "paragraph" ? "段落" : "摘要"}
      </div>

      {suggestion.reason && (
        <div className="text-xs text-gray-600 bg-white rounded p-2 border border-gray-100">
          <span className="font-medium">修改理由：</span>
          {suggestion.reason}
        </div>
      )}

      {/* 修改前后对比 */}
      <div className="space-y-1.5">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">修改前</div>
          <div className={cn(
            "text-xs text-gray-600 bg-red-50 rounded p-2 border border-red-100",
            !expanded && "line-clamp-2"
          )}>
            {suggestion.original_content}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">修改后</div>
          <div className={cn(
            "text-xs text-gray-700 bg-green-50 rounded p-2 border border-green-100",
            !expanded && "line-clamp-2"
          )}>
            {suggestion.suggested_content}
          </div>
        </div>
      </div>

      {/* 展开/收起按钮 */}
      {(suggestion.original_content.length > 100 || suggestion.suggested_content.length > 100) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-500 hover:text-blue-600"
        >
          {expanded ? "收起" : "展开查看完整内容"}
        </button>
      )}
    </div>
  )
}

// 插入文本内容
function InsertTextContent({ suggestion }: { suggestion: AISuggestion & { type: "insert_text" } }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-gray-600">
        位置：{suggestion.position === "start" ? "章节开头" : "章节末尾"}
      </div>
      <div className="text-xs text-gray-700 bg-white rounded p-2 border border-gray-100 max-h-32 overflow-y-auto">
        {suggestion.content}
      </div>
      {suggestion.description && (
        <div className="text-xs text-gray-500">
          {suggestion.description}
        </div>
      )}
    </div>
  )
}
