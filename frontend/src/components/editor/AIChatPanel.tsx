"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useEditorStore } from "@/store/editorStore"
import { useDocumentStore } from "@/store/documentStore"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

interface AIChatPanelProps {
  documentId: string
}

export default function AIChatPanel({ documentId }: AIChatPanelProps) {
  const { activeChapterId, activeParagraphId } = useEditorStore()
  const { tree, summaries } = useDocumentStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 找当前章节的段落（作为上下文）
  const findParagraphsInChapter = useCallback((chapterId: string | null) => {
    if (!chapterId) return []
    const walk = (nodes: typeof tree): typeof tree[0]["paragraphs"] => {
      for (const n of nodes) {
        if (n.chapter_id === chapterId) return n.paragraphs
        const found = walk(n.children)
        if (found.length) return found
      }
      return []
    }
    return walk(tree)
  }, [tree])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput("")
    setStreaming(true)

    // 构建上下文
    const paragraphs = findParagraphsInChapter(activeChapterId)
    const selectedParagraphs = activeParagraphId
      ? paragraphs.filter(p => p.paragraph_id === activeParagraphId).map(p => ({
          paragraph_id: p.paragraph_id,
          content: p.content,
          para_type: p.para_type,
        }))
      : []

    const selectedSummaries = summaries.slice(0, 3).map(s => ({
      summary_id: s.summary_id,
      title: s.title,
      content: s.content,
    }))

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          document_id: documentId,
          current_chapter_id: activeChapterId ?? undefined,
          selected_paragraphs: selectedParagraphs.length ? selectedParagraphs : undefined,
          selected_summaries: selectedSummaries.length ? selectedSummaries : undefined,
        }),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error("请求失败")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === "[DONE]") continue
          try {
            const parsed = JSON.parse(raw)
            if (parsed.response) {
              accumulated += parsed.response
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ))
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "请求失败，请重试", streaming: false }
          : m
      ))
    } finally {
      setStreaming(false)
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ))
    }
  }, [input, streaming, documentId, activeChapterId, activeParagraphId, findParagraphsInChapter, summaries])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleClear = () => {
    if (streaming) handleStop()
    setMessages([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-xs text-gray-500">
          {activeChapterId ? "当前章节上下文已加载" : "全文档上下文"}
        </span>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          清空
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-2">
            <p className="text-sm">AI 助手</p>
            <p className="text-xs">可以询问文档内容、请求修改建议、或让 AI 帮你完善章节</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
              msg.role === "user"
                ? "bg-blue-500 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-800 rounded-bl-sm"
            )}>
              {msg.content || (msg.streaming && (
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ))}
              {msg.streaming && msg.content && (
                <span className="inline-block w-0.5 h-3 bg-gray-500 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-blue-300 focus:bg-white transition leading-relaxed disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          {streaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition"
              title="停止"
            >
              ■
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition"
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
