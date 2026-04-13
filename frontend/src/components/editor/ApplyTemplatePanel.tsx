"use client"

import { useState } from "react"
import { documentService } from "@/services/documentService"
import { coreInfoService } from "@/services/coreInfoService"
import { summaryService } from "@/services/summaryService"
import { chapterService } from "@/services/chapterService"
import { useDocumentStore } from "@/store/documentStore"
import { cn } from "@/lib/utils"

interface ApplyTemplatePanelProps {
  documentId: string
  onClose: () => void
  onApplied: () => void  // 应用完成后刷新编辑器
}

type StepKey = "core-info" | "summary" | "structure"
type StepStatus = "idle" | "loading" | "done" | "error" | "skipped"

interface Step {
  key: StepKey
  label: string
  desc: string
  status: StepStatus
  message?: string
}

export default function ApplyTemplatePanel({ documentId, onClose, onApplied }: ApplyTemplatePanelProps) {
  const { setCoreInfoTree, setSummaries, setFullContent, documentTitle } = useDocumentStore()

  const [steps, setSteps] = useState<Step[]>([
    { key: "core-info", label: "核心信息模板", desc: "生成文档的核心信息字段结构", status: "idle" },
    { key: "summary",   label: "摘要模板",     desc: "生成文档各摘要的初始内容",   status: "idle" },
    { key: "structure", label: "章节结构模板", desc: "生成文档的章节目录和段落",   status: "idle" },
  ])
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  const setStepStatus = (key: StepKey, status: StepStatus, message?: string) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status, message } : s))
  }

  const handleApply = async (selected: Set<StepKey>) => {
    if (selected.size === 0) { onClose(); return }
    setApplying(true)

    // 按顺序执行：核心信息 → 摘要 → 章节结构
    const order: StepKey[] = ["core-info", "summary", "structure"]

    for (const key of order) {
      if (!selected.has(key)) {
        setStepStatus(key, "skipped")
        continue
      }

      setStepStatus(key, "loading")
      try {
        if (key === "core-info") {
          await documentService.applyCoreInfoTemplate(documentId)
          const res = await coreInfoService.getByDocument(documentId)
          setCoreInfoTree(res.items)
          setStepStatus(key, "done", "核心信息字段已生成")
        } else if (key === "summary") {
          await documentService.applySummaryTemplate(documentId)
          const res = await summaryService.getByDocument(documentId)
          setSummaries(res.summaries)
          setStepStatus(key, "done", "摘要已生成")
        } else if (key === "structure") {
          await documentService.applyStructureTemplate(documentId)
          const res = await chapterService.getFullContent(documentId)
          setFullContent(documentId, documentTitle ?? "", res.tree)
          setStepStatus(key, "done", "章节结构已生成")
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "应用失败"
        setStepStatus(key, "error", msg)
        // 继续执行后续步骤，不中断
      }
    }

    setApplying(false)
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">应用模板</h2>
          {!applying && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          )}
        </div>

        {!done ? (
          <SelectionView steps={steps} applying={applying} onApply={handleApply} onClose={onClose} />
        ) : (
          <ResultView steps={steps} onClose={() => { onApplied(); onClose() }} />
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 选择视图
// ----------------------------------------------------------------
function SelectionView({ steps, applying, onApply, onClose }: {
  steps: Step[]
  applying: boolean
  onApply: (selected: Set<StepKey>) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<StepKey>>(new Set(["core-info", "summary", "structure"]))

  const toggle = (key: StepKey) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const statusIcon: Record<StepStatus, string> = {
    idle: "", loading: "⟳", done: "✓", error: "✕", skipped: "—"
  }

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-3">
        <p className="text-sm text-gray-500">选择要应用的模板内容，未选择的部分可以后续手动添加。</p>

        {steps.map(step => (
          <div
            key={step.key}
            onClick={() => !applying && toggle(step.key as StepKey)}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition",
              selected.has(step.key as StepKey)
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 bg-white hover:bg-gray-50",
              applying && "cursor-not-allowed opacity-70"
            )}
          >
            {/* 勾选框 */}
            <div className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition",
              selected.has(step.key as StepKey)
                ? "border-blue-500 bg-blue-500"
                : "border-gray-300"
            )}>
              {selected.has(step.key as StepKey) && (
                <span className="text-white text-xs font-bold">✓</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{step.label}</span>
                {applying && step.status !== "idle" && (
                  <span className={cn(
                    "text-xs",
                    step.status === "loading" && "text-blue-500 animate-spin inline-block",
                    step.status === "done" && "text-green-500",
                    step.status === "error" && "text-red-500",
                    step.status === "skipped" && "text-gray-400",
                  )}>
                    {statusIcon[step.status]}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
              {applying && step.message && (
                <p className={cn(
                  "text-xs mt-0.5",
                  step.status === "error" ? "text-red-500" : "text-green-600"
                )}>{step.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-5 flex gap-2">
        <button
          onClick={() => onApply(selected)}
          disabled={applying || selected.size === 0}
          className="flex-1 h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
        >
          {applying ? "应用中..." : `应用选中项（${selected.size}）`}
        </button>
        <button
          onClick={onClose}
          disabled={applying}
          className="flex-1 h-9 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          跳过
        </button>
      </div>
    </>
  )
}

// ----------------------------------------------------------------
// 结果视图
// ----------------------------------------------------------------
function ResultView({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const doneCount = steps.filter(s => s.status === "done").length
  const errorCount = steps.filter(s => s.status === "error").length

  return (
    <>
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="text-center py-2">
          <div className="text-3xl mb-2">{errorCount === 0 ? "🎉" : "⚠️"}</div>
          <p className="text-sm font-medium text-gray-800">
            {errorCount === 0 ? "模板应用完成" : `完成（${errorCount} 项失败）`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            成功 {doneCount} 项，跳过 {steps.filter(s => s.status === "skipped").length} 项
          </p>
        </div>

        {steps.map(step => (
          <div key={step.key} className="flex items-center gap-3 py-1">
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              step.status === "done" && "bg-green-100 text-green-600",
              step.status === "error" && "bg-red-100 text-red-500",
              step.status === "skipped" && "bg-gray-100 text-gray-400",
            )}>
              {step.status === "done" ? "✓" : step.status === "error" ? "✕" : "—"}
            </span>
            <div className="flex-1">
              <span className="text-sm text-gray-700">{step.label}</span>
              {step.message && (
                <p className={cn(
                  "text-xs mt-0.5",
                  step.status === "error" ? "text-red-500" : "text-gray-400"
                )}>{step.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-5">
        <button
          onClick={onClose}
          className="w-full h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition"
        >
          开始编辑
        </button>
      </div>
    </>
  )
}
