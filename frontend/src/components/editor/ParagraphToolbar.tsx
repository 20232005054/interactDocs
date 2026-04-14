"use client"

import { useState, useRef } from "react"
import { useAIAssist } from "@/hooks/useAIAssist"
import { cn } from "@/lib/utils"

interface ParagraphToolbarProps {
  paragraphId: string
  chapterId: string
  hasContent: boolean
}

export default function ParagraphToolbar({ paragraphId, chapterId, hasContent }: ParagraphToolbarProps) {
  const { aiAssistingParagraphId, aiAssistPreview, startAssist, applyAssist, discardAssist } = useAIAssist()

  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState<{ evaluation: string; suggestions: string[] } | null>(null)
  const [evalPreview, setEvalPreview] = useState("")
  const [showEval, setShowEval] = useState(false)
  const evalAbortRef = useRef<AbortController | null>(null)

  const isAssisting = aiAssistingParagraphId === paragraphId
  const hasPreview = isAssisting && aiAssistPreview.length > 0

  // AI 评估
  const handleEvaluate = async () => {
    if (evaluating || !hasContent) return
    setEvaluating(true)
    setEvalPreview("")
    setEvalResult(null)
    setShowEval(true)

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const abort = new AbortController()
    evalAbortRef.current = abort

    try {
      const res = await fetch(`/api/v1/paragraphs/${paragraphId}/ai/evaluate`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error("请求失败")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

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
            if (parsed.content) setEvalPreview(prev => prev + parsed.content)
            if (parsed.evaluation !== undefined) {
              setEvalResult({ evaluation: parsed.evaluation, suggestions: parsed.suggestions ?? [] })
            }
          } catch {
            // 忽略
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setEvalPreview("评估失败，请重试")
      }
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* 工具栏按钮 */}
      <div className="flex items-center gap-1">
        {/* AI 帮填 */}
        {!isAssisting ? (
          <button
            type="button"
            onClick={() => startAssist(paragraphId, chapterId)}
            className="h-6 px-2 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition font-medium"
          >
            AI 帮填
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-500 animate-pulse">生成中...</span>
            {hasPreview && (
              <>
                <button
                  type="button"
                  onClick={() => applyAssist(paragraphId, chapterId)}
                  className="h-6 px-2 rounded text-xs bg-green-500 text-white hover:bg-green-600 transition"
                >
                  应用
                </button>
                <button
                  type="button"
                  onClick={discardAssist}
                  className="h-6 px-2 rounded text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                >
                  丢弃
                </button>
              </>
            )}
          </div>
        )}

        {/* AI 评估 */}
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={evaluating || !hasContent}
          className={cn(
            "h-6 px-2 rounded text-xs transition font-medium",
            hasContent
              ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
              : "bg-gray-50 text-gray-300 cursor-not-allowed"
          )}
        >
          {evaluating ? "评估中..." : "AI 评估"}
        </button>
      </div>

      {/* AI 帮填预览 */}
      {isAssisting && aiAssistPreview && (
        <div className="mt-1 p-2 rounded-md bg-blue-50 border border-blue-200 text-xs text-gray-700 leading-relaxed">
          <div className="text-xs text-blue-500 mb-1 font-medium">AI 生成预览</div>
          <p className="whitespace-pre-wrap">{aiAssistPreview}</p>
          {!hasPreview && (
            <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}

      {/* AI 评估结果 */}
      {showEval && (evalPreview || evalResult) && (
        <div className="mt-1 p-2 rounded-md bg-purple-50 border border-purple-200 text-xs leading-relaxed">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-500 font-medium">AI 评估结果</span>
            <button
              type="button"
              onClick={() => { setShowEval(false); setEvalPreview(""); setEvalResult(null) }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ×
            </button>
          </div>

          {evalResult ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-gray-700 whitespace-pre-wrap">{evalResult.evaluation}</p>
              {evalResult.suggestions.length > 0 && (
                <div>
                  <p className="text-purple-600 font-medium mb-0.5">改进建议：</p>
                  <ul className="flex flex-col gap-0.5">
                    {evalResult.suggestions.map((s, i) => (
                      <li key={i} className="text-gray-600 flex gap-1">
                        <span className="text-purple-400 shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">
              {evalPreview}
              {evaluating && (
                <span className="inline-block w-0.5 h-3 bg-purple-400 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
