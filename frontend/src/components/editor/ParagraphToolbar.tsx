"use client"

import { useRef, useState } from "react"
import { useAIAssist } from "@/hooks/useAIAssist"
import { useChatStore } from "@/store/chatStore"
import { paragraphService, type EvaluateAIResult } from "@/services/paragraphService"
import { cn } from "@/lib/utils"
import type { ParaType } from "@/types/api"

interface ParagraphToolbarProps {
  paragraphId: string
  chapterId: string
  chapterTitle: string
  paragraphContent: string
  paraType: ParaType
  hasContent: boolean
  visible: boolean
}

export default function ParagraphToolbar({
  paragraphId,
  chapterId,
  chapterTitle,
  paragraphContent,
  paraType,
  hasContent,
  visible,
}: ParagraphToolbarProps) {
  const { aiAssistingParagraphId, aiAssistPreview, startAssist, applyAssist, discardAssist } = useAIAssist()
  const upsertManualParagraphContext = useChatStore((state) => state.upsertManualParagraphContext)
  const hasContext = useChatStore((state) => state.contextItems.some((item) => (
    item.kind === "paragraph" && item.source === "manual" && item.paragraph_id === paragraphId
  )))

  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState<EvaluateAIResult | null>(null)
  const [evalPreview, setEvalPreview] = useState("")
  const [showEval, setShowEval] = useState(false)
  const [showAssistInput, setShowAssistInput] = useState(false)
  const [assistInstruction, setAssistInstruction] = useState("")
  const [assistError, setAssistError] = useState<string | null>(null)
  const evalAbortRef = useRef<AbortController | null>(null)

  const isAssisting = aiAssistingParagraphId === paragraphId
  const hasPreview = isAssisting && aiAssistPreview.length > 0

  const handleStartAssist = async () => {
    if (isAssisting) return
    setAssistError(null)
    setShowAssistInput(false)
    try {
      await startAssist(paragraphId, chapterId, assistInstruction)
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : "AI 帮填失败")
    }
  }

  const handleAddContext = () => {
    upsertManualParagraphContext({
      paragraph_id: paragraphId,
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      content: paragraphContent,
      para_type: paraType,
    })
  }

  // AI 评估
  const handleEvaluate = async () => {
    if (evaluating || !hasContent) return
    setEvaluating(true)
    setEvalPreview("")
    setEvalResult(null)
    setShowEval(true)

    const abort = new AbortController()
    evalAbortRef.current = abort

    try {
      await paragraphService.evaluateAI(paragraphId, {
        signal: abort.signal,
        onChunk: (chunk) => setEvalPreview((prev) => prev + chunk),
        onResult: (result) => setEvalResult(result),
      })
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
      <div
        className={cn(
          "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 px-1.5 py-1 shadow-sm transition",
          "opacity-0 pointer-events-none",
          (visible || isAssisting || showEval || showAssistInput) && "opacity-100 pointer-events-auto"
        )}
      >
        <button
          type="button"
          onClick={() => setShowAssistInput((prev) => !prev)}
          disabled={isAssisting}
          className={cn(
            "h-6 px-2 rounded text-xs transition font-medium",
            isAssisting
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          )}
        >
          {isAssisting ? "生成中..." : "AI 帮填"}
        </button>
        <button
          type="button"
          onClick={handleAddContext}
          className={cn(
            "h-6 px-2 rounded text-xs transition font-medium",
            hasContext
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
              : "bg-amber-50 text-amber-600 hover:bg-amber-100"
          )}
        >
          {hasContext ? "已加上下文" : "添加上下文"}
        </button>
        <button
          type="button"
          onClick={() => { void handleEvaluate() }}
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
      {showAssistInput && !isAssisting && (
        <div className="absolute right-2 top-10 z-20 w-80 rounded-md border border-blue-200 bg-blue-50 p-2 shadow-md">
          <div className="mb-1 text-xs font-medium text-blue-600">提示词</div>
          <textarea
            value={assistInstruction}
            onChange={(event) => setAssistInstruction(event.target.value)}
            rows={3}
            placeholder="请输入本次 AI 帮填提示词（会保存到模板自定义提示词）"
            className="w-full resize-none rounded border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-400"
          />
          {assistError && <p className="mt-1 text-xs text-red-500">{assistError}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartAssist}
              className="h-6 rounded bg-blue-600 px-2 text-xs text-white hover:bg-blue-700 transition"
            >
              生成
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAssistInput(false)
                setAssistError(null)
              }}
              className="h-6 rounded bg-white px-2 text-xs text-gray-500 hover:bg-gray-50 transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {isAssisting && aiAssistPreview && (
        <div className="mt-8 p-2 rounded-md bg-blue-50 border border-blue-200 text-xs text-gray-700 leading-relaxed">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-blue-500">AI 生成预览</div>
            {hasPreview && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyAssist(paragraphId, chapterId)}
                  className="h-6 rounded bg-green-500 px-2 text-[11px] text-white hover:bg-green-600 transition"
                >
                  应用
                </button>
                <button
                  type="button"
                  onClick={discardAssist}
                  className="h-6 rounded bg-white px-2 text-[11px] text-gray-500 hover:bg-gray-50 transition"
                >
                  丢弃
                </button>
              </div>
            )}
          </div>
          <p className="whitespace-pre-wrap">{aiAssistPreview}</p>
          {!hasPreview && (
            <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}

      {/* AI 评估结果 */}
      {showEval && (evalPreview || evalResult) && (
        <div className={cn("p-2 rounded-md bg-purple-50 border border-purple-200 text-xs leading-relaxed", isAssisting && aiAssistPreview ? "mt-2" : "mt-8")}>
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
