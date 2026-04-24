"use client"

import { useState, useCallback } from "react"
import { documentService } from "@/services/documentService"
import { coreInfoService } from "@/services/coreInfoService"
import { summaryService } from "@/services/summaryService"
import { chapterService } from "@/services/chapterService"
import { useDocumentStore } from "@/store/documentStore"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { cn } from "@/lib/utils"

type StepKey = "core-info" | "summary" | "structure"
type StepStatus = "idle" | "applying" | "done" | "error"

const STEPS = [
  { key: "core-info" as StepKey, label: "核心信息模板", desc: "定义文档的核心信息字段结构，可在应用前修改" },
  { key: "summary"   as StepKey, label: "摘要模板",     desc: "定义各摘要的生成方式和来源，可在应用前修改" },
  { key: "structure" as StepKey, label: "章节结构模板", desc: "定义文档的章节目录和内容生成规则，可在应用前修改" },
]

interface ApplyTemplateModalProps {
  documentId: string
  templateId: string
  docTitle: string
  onClose: () => void
  onApplied: () => void
}

export default function ApplyTemplateModal({
  documentId, templateId, docTitle, onClose, onApplied
}: ApplyTemplateModalProps) {
  const { setFullContent, setSummaries, setCoreInfoTree, documentTitle } = useDocumentStore()
  const [activeStep, setActiveStep] = useState<StepKey>("core-info")
  const [stepStatus, setStepStatus] = useState<Record<StepKey, StepStatus>>({
    "core-info": "idle",
    "summary": "idle",
    "structure": "idle",
  })
  const [stepError, setStepError] = useState<Record<StepKey, string | null>>({
    "core-info": null,
    "summary": null,
    "structure": null,
  })

  const currentIndex = STEPS.findIndex(s => s.key === activeStep)
  const anyApplying = Object.values(stepStatus).some(s => s === "applying")

  const handleApplyStep = useCallback(async (key: StepKey) => {
    setStepStatus(prev => ({ ...prev, [key]: "applying" }))
    setStepError(prev => ({ ...prev, [key]: null }))
    try {
      if (key === "core-info") {
        await documentService.applyCoreInfoTemplate(documentId)
        const res = await coreInfoService.getByDocument(documentId)
        setCoreInfoTree(res.items)
      } else if (key === "summary") {
        await documentService.applySummaryTemplate(documentId)
        const res = await summaryService.getByDocument(documentId)
        setSummaries(res.summaries)
      } else if (key === "structure") {
        await documentService.applyStructureTemplate(documentId)
        const res = await chapterService.getFullContent(documentId)
        setFullContent(documentId, documentTitle ?? docTitle, res.tree)
      }
      setStepStatus(prev => ({ ...prev, [key]: "done" }))
      onApplied()
    } catch (err: unknown) {
      setStepStatus(prev => ({ ...prev, [key]: "error" }))
      setStepError(prev => ({ ...prev, [key]: err instanceof Error ? err.message : "应用失败" }))
    }
  }, [documentId, documentTitle, docTitle, setCoreInfoTree, setSummaries, setFullContent, onApplied])

  const statusLabel: Record<StepStatus, string> = {
    idle: "应用此步骤",
    applying: "应用中...",
    done: "已应用 ✓",
    error: "重新应用",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col h-[85vh]">

        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">应用模板</h2>
            <p className="text-xs text-gray-400 mt-0.5">{docTitle} — 修改将保存到文档的私有模板副本，每步可单独应用</p>
          </div>
          <button onClick={onClose} disabled={anyApplying}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-40">×</button>
        </div>

        {/* 步骤导航 */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-gray-100 shrink-0">
          {STEPS.map((step, idx) => {
            const isActive = step.key === activeStep
            const status = stepStatus[step.key]
            return (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() => !anyApplying && setActiveStep(step.key)}
                  disabled={anyApplying}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm",
                    isActive && "bg-green-50",
                    !isActive && !anyApplying && "hover:bg-gray-50",
                    anyApplying && "cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition shrink-0",
                    isActive && status !== "done" && "border-green-500 bg-green-500 text-white",
                    status === "done" && "border-green-400 bg-green-100 text-green-600",
                    status === "error" && "border-red-400 bg-red-100 text-red-500",
                    !isActive && status === "idle" && "border-gray-300 text-gray-400"
                  )}>
                    {status === "done" ? "✓" : status === "error" ? "!" : idx + 1}
                  </div>
                  <span className={cn(
                    "font-medium text-sm",
                    isActive ? "text-green-700" : "text-gray-500"
                  )}>{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && <div className="w-10 h-px bg-gray-200 mx-1" />}
              </div>
            )
          })}
        </div>

        {/* 步骤说明 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <p className="text-xs text-gray-500">{STEPS[currentIndex].desc}</p>
        </div>

        {/* 内容区（可滚动） */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeStep === "core-info" && <CoreInfoTemplateStep templateId={templateId} />}
          {activeStep === "summary"   && <SummaryTemplateStep  templateId={templateId} />}
          {activeStep === "structure" && <StructureTemplateStep templateId={templateId} />}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} disabled={anyApplying}
            className="h-9 px-4 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            关闭
          </button>

          <div className="flex items-center gap-2">
            {/* 上一步 / 下一步 */}
            {currentIndex > 0 && (
              <button onClick={() => setActiveStep(STEPS[currentIndex - 1].key)} disabled={anyApplying}
                className="h-9 px-3 rounded border border-gray-300 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition">
                ← 上一步
              </button>
            )}
            {currentIndex < STEPS.length - 1 && (
              <button onClick={() => setActiveStep(STEPS[currentIndex + 1].key)} disabled={anyApplying}
                className="h-9 px-3 rounded border border-gray-300 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition">
                下一步 →
              </button>
            )}

            {/* 当前步骤应用按钮 */}
            {stepError[activeStep] && (
              <span className="text-xs text-red-500">{stepError[activeStep]}</span>
            )}
            <button
              onClick={() => handleApplyStep(activeStep)}
              disabled={anyApplying}
              className={cn(
                "h-9 px-5 rounded text-sm font-medium transition",
                stepStatus[activeStep] === "done"
                  ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                  : stepStatus[activeStep] === "error"
                    ? "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    : "bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
              )}
            >
              {statusLabel[stepStatus[activeStep]]}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
