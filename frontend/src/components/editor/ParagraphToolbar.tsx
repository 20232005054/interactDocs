"use client"

import { useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "tiptap-markdown"
import { Sparkles, Loader2 } from "lucide-react"
import { useAIAssist } from "@/hooks/useAIAssist"
import { useChatStore } from "@/store/chatStore"
import { paragraphService, type EvaluateAIResult } from "@/services/paragraphService"
import ParagraphLiteraturePanel from "./ParagraphLiteraturePanel"
import { cn } from "@/lib/utils"
import type { ParaType } from "@/types/api"

// 只读 Markdown 渲染组件，用于 AI 预览
function MarkdownPreview({ content, streaming }: { content: string; streaming?: boolean }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, breaks: true }),
    ],
    content,
    editable: false,
    immediatelyRender: false,
  })

  // 流式更新内容
  if (editor) {
    const current = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }

  return (
    <div className="prose prose-xs max-w-none text-gray-700 [&_.tiptap]:outline-none">
      <EditorContent editor={editor} />
      {streaming && (
        <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}

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
  const [showLiterature, setShowLiterature] = useState(false)
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
          "flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 px-1.5 py-1 shadow-sm transition w-fit",
          "opacity-0 pointer-events-none h-0 overflow-hidden",
          (visible || isAssisting || showEval || showAssistInput || showLiterature) && "opacity-100 pointer-events-auto h-auto overflow-visible"
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
        <button
          type="button"
          onClick={() => setShowLiterature((prev) => !prev)}
          className={cn(
            "h-6 px-2 rounded text-xs transition font-medium",
            showLiterature
              ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          )}
        >
          {showLiterature ? "收起文献" : "文献管理"}
        </button>
      </div>

      {/* AI 帮填提示词输入 */}
      {showAssistInput && !isAssisting && (
        <div className="mt-1 w-full rounded-md border border-blue-200 bg-blue-50 p-2">
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
        <div className="mt-1 p-3 rounded-md bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-blue-600">AI 生成预览</span>
              {!hasPreview && (
                <span className="flex items-center gap-1 text-[10px] text-blue-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>生成中...</span>
                </span>
              )}
            </div>
            {hasPreview && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyAssist(paragraphId, chapterId)}
                  className="h-7 rounded-md bg-green-500 px-3 text-xs font-medium text-white hover:bg-green-600 transition shadow-sm"
                >
                  ✓ 应用
                </button>
                <button
                  type="button"
                  onClick={discardAssist}
                  className="h-7 rounded-md bg-white border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  × 丢弃
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-700 leading-relaxed">
            <MarkdownPreview content={aiAssistPreview} streaming={!hasPreview} />
          </div>
        </div>
      )}

      {/* AI 评估结果 */}
      {showEval && (evalPreview || evalResult) && (
        <div className={cn("p-3 rounded-md bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 shadow-sm", isAssisting && aiAssistPreview ? "mt-2" : "mt-1")}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">AI 评估结果</span>
              {evaluating && (
                <span className="flex items-center gap-1 text-[10px] text-purple-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>评估中...</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setShowEval(false); setEvalPreview(""); setEvalResult(null) }}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold leading-none"
            >
              ×
            </button>
          </div>

          {evalResult ? (
            <div className="flex flex-col gap-2 text-xs leading-relaxed">
              <p className="text-gray-700 whitespace-pre-wrap">{evalResult.evaluation}</p>
              {evalResult.suggestions.length > 0 && (
                <div>
                  <p className="text-purple-600 font-medium mb-1">改进建议：</p>
                  <ul className="flex flex-col gap-1">
                    {evalResult.suggestions.map((s, i) => (
                      <li key={i} className="text-gray-600 flex gap-1.5">
                        <span className="text-purple-400 shrink-0 font-medium">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {evalPreview}
            </p>
          )}
        </div>
      )}

      {/* 段落文献管理面板 */}
      <ParagraphLiteraturePanel
        paragraphId={paragraphId}
        visible={showLiterature}
        onClose={() => setShowLiterature(false)}
      />
    </div>
  )
}
