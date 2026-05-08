"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { aiService } from "@/services/aiService"
import { chapterService } from "@/services/chapterService"
import { paragraphService } from "@/services/paragraphService"
import { summaryService } from "@/services/summaryService"
import { useEditorStore } from "@/store/editorStore"
import { useChatStore } from "@/store/chatStore"
import { toastSuccess, toastError } from "@/hooks/useToast"
import ChatMessageList, { type ChatMessage } from "./ChatMessageList"
import ChatInput from "./ChatInput"
import ChatContextBar from "./ChatContextBar"
import type { AISuggestion, RawSuggestion } from "@/types/ai-suggestions"

interface AIChatPanelProps {
  documentId: string
  onReload?: () => void
}

export default function AIChatPanel({ documentId, onReload }: AIChatPanelProps) {
  const { activeChapterId } = useEditorStore()
  const contextItems = useChatStore((state) => state.contextItems)
  const removeContext = useChatStore((state) => state.removeContext)
  const clearContexts = useChatStore((state) => state.clearContexts)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true)
      try {
        const history = await aiService.getChatHistory(documentId, 1, 50)
        
        // 将历史记录转换为消息格式
        const historyMessages: ChatMessage[] = []
        for (const item of history.items) {
          // 用户消息
          historyMessages.push({
            id: `${item.chat_id}-user`,
            role: "user",
            content: item.message,
          })
          
          // AI 回复
          if (item.response) {
            // 解析响应中的 [SUGGESTION] 格式
            let cleanResponse = item.response
            let suggestions: AISuggestion[] = []
            
            // 匹配 [SUGGESTION]{...} 格式
            const suggestionRegex = /\[SUGGESTION\](\{[^}]+\})/g
            const matches = [...item.response.matchAll(suggestionRegex)]
            
            if (matches.length > 0) {
              // 移除原始 JSON，只保留文本部分
              cleanResponse = item.response.replace(suggestionRegex, "").trim()
              
              // 解析每个建议
              suggestions = matches.map((match, index) => {
                try {
                  const raw = JSON.parse(match[1]) as RawSuggestion
                  return {
                    ...raw,
                    id: `${item.chat_id}-suggestion-${index}`,
                    status: "pending" as const,
                  } as AISuggestion
                } catch (err) {
                  console.error("解析建议失败:", err)
                  return null
                }
              }).filter((s): s is AISuggestion => s !== null)
            }
            
            historyMessages.push({
              id: `${item.chat_id}-assistant`,
              role: "assistant",
              content: cleanResponse,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            })
          }
        }
        
        setMessages(historyMessages)
      } catch (err) {
        console.error("加载历史记录失败:", err)
        // 静默失败，不影响用户使用
      } finally {
        setLoadingHistory(false)
      }
    }

    loadHistory()
  }, [documentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 应用单个建议
  const applySuggestion = useCallback(async (suggestion: AISuggestion) => {
    try {
      switch (suggestion.type) {
        case "create_chapter": {
          let newChapterId: string
          if (suggestion.parent_id) {
            const newChapter = await chapterService.createSub(documentId, suggestion.parent_id)
            newChapterId = newChapter.chapter_id
          } else {
            const newChapter = await chapterService.create(documentId)
            newChapterId = newChapter.chapter_id
          }
          // 更新章节标题
          await chapterService.update(newChapterId, { title: suggestion.title })
          toastSuccess(`已创建章节：${suggestion.title}`)
          break
        }

        case "create_paragraph": {
          await paragraphService.create(suggestion.chapter_id, {
            para_type: suggestion.para_type,
            content: suggestion.content,
          })
          toastSuccess("已创建段落")
          break
        }

        case "edit_content": {
          if (suggestion.target_type === "paragraph") {
            await paragraphService.update(suggestion.target_id, {
              content: suggestion.suggested_content,
            })
            toastSuccess("已应用修改")
          } else if (suggestion.target_type === "summary") {
            await summaryService.update(suggestion.target_id, {
              content: suggestion.suggested_content,
            })
            toastSuccess("已应用修改")
          }
          break
        }

        case "insert_text": {
          // 获取章节的段落列表
          const paragraphs = await paragraphService.getByChapter(suggestion.chapter_id)
          if (suggestion.position === "start") {
            // 插入到开头：创建新段落
            await paragraphService.create(suggestion.chapter_id, {
              para_type: "paragraph",
              content: suggestion.content,
            })
          } else {
            // 插入到末尾：在最后一个段落后插入
            if (paragraphs.paragraphs.length > 0) {
              const lastParagraph = paragraphs.paragraphs[paragraphs.paragraphs.length - 1]
              await paragraphService.insertAfter(lastParagraph.paragraph_id, {
                para_type: "paragraph",
                content: suggestion.content,
              })
            } else {
              // 如果章节没有段落，直接创建
              await paragraphService.create(suggestion.chapter_id, {
                para_type: "paragraph",
                content: suggestion.content,
              })
            }
          }
          toastSuccess("已插入文本")
          break
        }
      }

      // 更新建议状态为已应用
      setMessages(prev => prev.map(msg => ({
        ...msg,
        suggestions: msg.suggestions?.map(s =>
          s.id === suggestion.id ? { ...s, status: "applied" as const } : s
        ),
      })))

      // 刷新页面内容
      if (onReload) {
        onReload()
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "应用建议失败")
      throw err
    }
  }, [documentId, onReload])

  // 拒绝单个建议
  const rejectSuggestion = useCallback((suggestion: AISuggestion) => {
    setMessages(prev => prev.map(msg => ({
      ...msg,
      suggestions: msg.suggestions?.map(s =>
        s.id === suggestion.id ? { ...s, status: "rejected" as const } : s
      ),
    })))
  }, [])

  // 批量应用所有待处理的建议
  const applyAllSuggestions = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message?.suggestions) return

    const pendingSuggestions = message.suggestions.filter(s => s.status === "pending")
    
    for (const suggestion of pendingSuggestions) {
      try {
        await applySuggestion(suggestion)
      } catch (err) {
        // 继续应用其他建议
        console.error("应用建议失败:", err)
      }
    }
  }, [messages, applySuggestion])

  // 批量拒绝所有待处理的建议
  const rejectAllSuggestions = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg
      return {
        ...msg,
        suggestions: msg.suggestions?.map(s =>
          s.status === "pending" ? { ...s, status: "rejected" as const } : s
        ),
      }
    }))
  }, [])

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

      // 解析建议
      let suggestions: AISuggestion[] = []
      if (result.suggestions && Array.isArray(result.suggestions)) {
        suggestions = result.suggestions.map((raw: RawSuggestion) => ({
          ...raw,
          id: `suggestion-${Date.now()}-${Math.random()}`,
          status: "pending" as const,
        } as AISuggestion))
      }

      setMessages((prev) => prev.map((message) => (
        message.id === assistantId
          ? { 
              ...message, 
              content: result.response, 
              streaming: false,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            }
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

  const handleCopy = useCallback(async (message: ChatMessage) => {
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

  const handleQuote = useCallback((message: ChatMessage) => {
    if (!message.content.trim()) return
    const quote = `引用内容：\n${message.content}\n\n`
    setInput((prev) => (prev ? `${prev}\n${quote}` : quote))
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
    await streamAssistantReply(text, assistantId)
  }, [input, streaming, streamAssistantReply])

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleClearConversation = async () => {
    if (streaming) handleStop()
    
    try {
      await aiService.clearChatHistory(documentId)
      setMessages([])
      toastSuccess("对话记录已清空")
    } catch (err) {
      toastError(err instanceof Error ? err.message : "清空失败")
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {/* 顶部工具栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <span className="text-sm text-gray-500">
          {activeChapterId ? "当前章节上下文已加载" : "全文档上下文"}
        </span>
        <button
          onClick={handleClearConversation}
          className="text-sm text-gray-400 transition hover:text-gray-600"
        >
          清空对话
        </button>
      </div>

      {/* 消息列表区域 */}
      <div className="compact-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {loadingHistory ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <div className="relative">
              <div className="w-8 h-8 border-4 border-gray-200 rounded-full" />
              <div className="absolute inset-0 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm">加载历史记录...</p>
          </div>
        ) : (
          <>
            <ChatMessageList
              messages={messages}
              streaming={streaming}
              onCopy={handleCopy}
              onRegenerate={handleRegenerate}
              onQuote={handleQuote}
              onApplySuggestion={applySuggestion}
              onRejectSuggestion={rejectSuggestion}
              onApplyAllSuggestions={applyAllSuggestions}
              onRejectAllSuggestions={rejectAllSuggestions}
              copiedMessageId={copiedMessageId}
            />
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3">
        <ChatContextBar
          contextItems={contextItems}
          onRemoveContext={removeContext}
          onClearContexts={clearContexts}
        />
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => void handleSend()}
          onStop={handleStop}
          streaming={streaming}
        />
      </div>
    </div>
  )
}
