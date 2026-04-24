"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { aiService } from "@/services/aiService"
import { useEditorStore } from "@/store/editorStore"
import { useChatStore, type ChatContextItem } from "@/store/chatStore"
import { cn } from "@/lib/utils"

const INPUT_MAX_HEIGHT = 120

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

interface AIChatPanelProps {
  documentId: string
}

function getContextMeta(item: ChatContextItem) {
  if (item.kind === "paragraph") {
    const typeLabelMap: Record<string, string> = {
      paragraph: "正文",
      heading1: "一级标题",
      heading2: "二级标题",
      heading3: "三级标题",
    }

    const title = item.chapter_title ? `${item.chapter_title} · ${typeLabelMap[item.para_type ?? "paragraph"]}` : "段落上下文"
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

export default function AIChatPanel({ documentId }: AIChatPanelProps) {
  const { activeChapterId } = useEditorStore()
  const contextItems = useChatStore((state) => state.contextItems)
  const removeContext = useChatStore((state) => state.removeContext)
  const clearContexts = useChatStore((state) => state.clearContexts)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = "auto"
    const nextHeight = Math.min(element.scrollHeight, INPUT_MAX_HEIGHT)
    element.style.height = `${nextHeight}px`
    element.style.overflowY = element.scrollHeight > INPUT_MAX_HEIGHT ? "auto" : "hidden"
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current)
  }, [input, adjustTextareaHeight])

  const streamAssistantReply = useCallback(async (text: string, assistantId: string) => {
    if (!text.trim()) return
    setStreaming(true)
    const selectedParagraphs = contextItems
      .filter((item) => item.kind === "paragraph")
      .map((item) => ({
        paragraph_id: item.paragraph_id,
        para_type: item.para_type,
        content: item.selected_text
          ? `用户重点选中的片段：${item.selected_text}\n\n段落全文：${item.content}`
          : item.content,
      }))

    const selectedSummaries = contextItems
      .filter((item) => item.kind === "summary")
      .map((item) => ({
        summary_id: item.summary_id,
        title: item.title,
        content: item.content,
      }))

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const result = await aiService.chatStream(
        {
          message: text,
          document_id: documentId,
          current_chapter_id: activeChapterId ?? undefined,
          selected_paragraphs: selectedParagraphs.length ? selectedParagraphs : undefined,
          selected_summaries: selectedSummaries.length ? selectedSummaries : undefined,
        },
        {
          signal: abort.signal,
          onChunk: (_, accumulated) => {
            setMessages((prev) => prev.map((message) => (
              message.id === assistantId
                ? { ...message, content: accumulated }
                : message
            )))
          },
        }
      )

      setMessages((prev) => prev.map((message) => (
        message.id === assistantId
          ? { ...message, content: result.response, streaming: false }
          : message
      )))
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return
      setMessages((prev) => prev.map((message) => (
        message.id === assistantId
          ? { ...message, content: err instanceof Error ? err.message : "请求失败，请重试", streaming: false }
          : message
      )))
    } finally {
      abortRef.current = null
      setStreaming(false)
      setMessages((prev) => prev.map((message) => (
        message.id === assistantId ? { ...message, streaming: false } : message
      )))
    }
  }, [activeChapterId, contextItems, documentId])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
    await streamAssistantReply(text, assistantId)
  }, [input, streaming, streamAssistantReply])

  const handleRegenerate = useCallback(async (assistantId: string) => {
    if (streaming) return

    const assistantIndex = messages.findIndex((message) => message.id === assistantId && message.role === "assistant")
    if (assistantIndex < 0) return

    let prompt = ""
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        prompt = messages[index].content
        break
      }
    }
    if (!prompt.trim()) return

    setMessages((prev) => prev.map((message) => (
      message.id === assistantId
        ? { ...message, content: "", streaming: true }
        : message
    )))
    await streamAssistantReply(prompt, assistantId)
  }, [messages, streaming, streamAssistantReply])

  const handleCopy = useCallback(async (message: Message) => {
    if (!message.content.trim()) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current))
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  const handleQuote = useCallback((message: Message) => {
    if (!message.content.trim()) return
    const quote = `引用内容：\n${message.content}\n\n`
    setInput((prev) => (prev ? `${prev}\n${quote}` : quote))
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleClearConversation = () => {
    if (streaming) handleStop()
    setMessages([])
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs text-gray-500">
          {activeChapterId ? "当前章节上下文已加载" : "全文档上下文"}
        </span>
        <button
          onClick={handleClearConversation}
          className="text-xs text-gray-400 transition hover:text-gray-600"
        >
          清空对话
        </button>
      </div>

      <div className="compact-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
            <p className="text-sm">AI 助手</p>
            <p className="text-xs">点击段落或使用“添加上下文”，再向 AI 提问</p>
          </div>
        )}

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
                  "w-fit max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-xs leading-relaxed",
                  message.role === "user"
                    ? "rounded-br-sm bg-blue-500 text-white"
                    : "rounded-bl-sm bg-gray-100 text-gray-800"
                )}
              >
                {message.content || (message.streaming && (
                  <span className="inline-flex gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                  </span>
                ))}
                {message.streaming && message.content && (
                  <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse align-middle bg-gray-500" />
                )}
              </div>
              {message.role === "assistant" && !message.streaming && !!message.content.trim() && (
                <div className="mt-1 flex items-center gap-2 pl-1 text-[11px] text-gray-400">
                  <button
                    type="button"
                    onClick={() => void handleCopy(message)}
                    className="hover:text-gray-600 transition"
                  >
                    {copiedMessageId === message.id ? "已复制" : "复制"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRegenerate(message.id)}
                    className="hover:text-gray-600 transition"
                  >
                    重新生成
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuote(message)}
                    className="hover:text-gray-600 transition"
                  >
                    引用
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-gray-100 px-3 py-2">
        {contextItems.length > 0 && (
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
                      onClick={() => removeContext(item.context_id)}
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
              onClick={clearContexts}
              className="shrink-0 pt-1 text-[11px] text-gray-400 transition hover:text-gray-600"
            >
              清空上下文
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-11 text-xs leading-relaxed outline-none transition focus:border-blue-300 focus:bg-white disabled:opacity-50"
            style={{ maxHeight: `${INPUT_MAX_HEIGHT}px`, overflowY: "hidden" }}
            onInput={(event) => adjustTextareaHeight(event.currentTarget)}
          />

          {streaming ? (
            <button
              onClick={handleStop}
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-red-100 text-red-500 transition hover:bg-red-200"
              title="停止"
            >
              ■
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 text-white transition hover:bg-blue-600 disabled:opacity-40"
              title="发送"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
