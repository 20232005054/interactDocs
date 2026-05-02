"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import MarkdownContent from "@/components/ui/MarkdownContent"
import AISuggestionList from "./AISuggestionList"
import type { AISuggestion } from "@/types/ai-suggestions"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  suggestions?: AISuggestion[]
}

interface ChatMessageListProps {
  messages: ChatMessage[]
  streaming: boolean
  onCopy: (message: ChatMessage) => void
  onRegenerate: (messageId: string) => void
  onQuote: (message: ChatMessage) => void
  onApplySuggestion: (suggestion: AISuggestion) => Promise<void>
  onRejectSuggestion: (suggestion: AISuggestion) => void
  onApplyAllSuggestions: (messageId: string) => Promise<void>
  onRejectAllSuggestions: (messageId: string) => void
  copiedMessageId: string | null
}

export default function ChatMessageList({
  messages,
  streaming,
  onCopy,
  onRegenerate,
  onQuote,
  onApplySuggestion,
  onRejectSuggestion,
  onApplyAllSuggestions,
  onRejectAllSuggestions,
  copiedMessageId,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
        <p className="text-sm">AI 助手</p>
        <p className="text-xs">点击段落或使用"添加上下文"，再向 AI 提问</p>
      </div>
    )
  }

  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex min-w-0",
            message.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 max-w-[85%] flex-col",
              message.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "w-fit max-w-full rounded-xl px-3 py-2 text-xs leading-relaxed",
                message.role === "user"
                  ? "rounded-br-sm bg-blue-500 text-white whitespace-pre-wrap break-words"
                  : "rounded-bl-sm bg-gray-100 text-gray-800"
              )}
            >
              {message.role === "user" ? (
                // 用户消息：纯文本显示
                message.content
              ) : (
                // AI 消息：Markdown 渲染
                message.content ? (
                  <MarkdownContent content={message.content} />
                ) : message.streaming ? (
                  <span className="inline-flex gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </span>
                ) : null
              )}
              {message.streaming && message.content && (
                <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse align-middle bg-gray-500" />
              )}
            </div>

            {/* AI 消息操作按钮 */}
            {message.role === "assistant" && !message.streaming && !!message.content.trim() && (
              <div className="mt-1 flex items-center gap-2 pl-1 text-[11px] text-gray-400">
                <button
                  type="button"
                  onClick={() => onCopy(message)}
                  className="hover:text-gray-600 transition"
                >
                  {copiedMessageId === message.id ? "已复制" : "复制"}
                </button>
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  disabled={streaming}
                  className="hover:text-gray-600 transition disabled:opacity-50"
                >
                  重新生成
                </button>
                <button
                  type="button"
                  onClick={() => onQuote(message)}
                  className="hover:text-gray-600 transition"
                >
                  引用
                </button>
              </div>
            )}

            {/* AI 建议列表 */}
            {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
              <div className="mt-2 w-full">
                <AISuggestionList
                  suggestions={message.suggestions}
                  onApply={onApplySuggestion}
                  onReject={onRejectSuggestion}
                  onApplyAll={() => onApplyAllSuggestions(message.id)}
                  onRejectAll={() => onRejectAllSuggestions(message.id)}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  )
}
