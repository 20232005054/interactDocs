"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, CheckCheck, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import AISuggestionCard from "./AISuggestionCard"
import type { AISuggestion } from "@/types/ai-suggestions"

interface AISuggestionListProps {
  suggestions: AISuggestion[]
  onApply: (suggestion: AISuggestion) => Promise<void>
  onReject: (suggestion: AISuggestion) => void
  onApplyAll: () => Promise<void>
  onRejectAll: () => void
}

export default function AISuggestionList({
  suggestions,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll,
}: AISuggestionListProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [applyingAll, setApplyingAll] = useState(false)

  // 统计各状态的建议数量
  const pendingCount = suggestions.filter(s => s.status === "pending").length
  const appliedCount = suggestions.filter(s => s.status === "applied").length
  const rejectedCount = suggestions.filter(s => s.status === "rejected").length

  // 如果没有建议，不显示
  if (suggestions.length === 0) {
    return null
  }

  const handleApplyAll = async () => {
    setApplyingAll(true)
    try {
      await onApplyAll()
    } finally {
      setApplyingAll(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-100/50 border-b border-blue-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
          <span>💡 AI 建议</span>
          <span className="text-xs text-blue-600">
            ({pendingCount} 待处理
            {appliedCount > 0 && `, ${appliedCount} 已应用`}
            {rejectedCount > 0 && `, ${rejectedCount} 已忽略`})
          </span>
        </button>

        {/* 批量操作按钮 */}
        {pendingCount > 0 && !collapsed && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
            <button
              onClick={handleApplyAll}
              disabled={applyingAll}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md disabled:opacity-50 active:scale-95"
              )}
            >
              <CheckCheck className="w-3 h-3" />
              {applyingAll ? "应用中..." : "全部应用"}
            </button>
            <button
              onClick={onRejectAll}
              disabled={applyingAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 active:scale-95"
            >
              <XCircle className="w-3 h-3" />
              忽略全部
            </button>
          </div>
        )}
      </div>

      {/* 建议列表 */}
      {!collapsed && (
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {suggestions.map((suggestion) => (
            <AISuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={onApply}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
