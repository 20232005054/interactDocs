"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
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

interface Step {
  key: StepKey
  label: string
  desc: string
}

const STEPS: Step[] = [
  { key: "core-info", label: "核心信息模板", desc: "定义文档的核心信息字段结构" },
  { key: "summary",   label: "摘要模板",     desc: "定义各摘要的生成方式和来源" },
  { key: "structure", label: "章节结构模板", desc: "定义文档的章节目录和内容生成规则" },
]

interface ApplyTemplateEditorContainerProps {
  documentId: string
}

export default function ApplyTemplateEditorContainer({ documentId }: ApplyTemplateEditorContainerProps) {
  const router = useRouter()
  const { setFullContent, setSummaries, setCoreInfoTree, documentTitle } = useDocumentStore()

  const [templateId, setTemplateId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<StepKey>("core-info")
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  // 加载文档获取私有模板 ID
  useEffect(() => {
    const load = async () => {
      try {
        const doc = await documentService.get(documentId)
        if (!doc.template_id) throw new Error("文档未关联模板")
        setTemplateId(doc.template_id)
        setDocTitle(doc.title)
      } catch (err: unknown) {
        setApplyError(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [documentId])

  const currentStepIndex = STEPS.findIndex(s => s.key === activeStep)
  const isLastStep = currentStepIndex === STEPS.length - 1

  const handleNext = () => {
    if (!isLastStep) {
      setActiveStep(STEPS[currentStepIndex + 1].key)
    }
  }

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setActiveStep(STEPS[currentStepIndex - 1].key)
    }
  }

  // 确认应用：依次调三个 apply 接口，然后刷新 store 并跳回编辑器
  const handleApply = useCallback(async () => {
    setApplying(true)
    setApplyError(null)
    try {
      await documentService.applyCoreInfoTemplate(documentId)
      await documentService.applySummaryTemplate(documentId)
      await documentService.applyStructureTemplate(documentId)

      // 刷新 store
      const [coreRes, summaryRes, fullContent] = await Promise.all([
        coreInfoService.getByDocument(documentId),
        summaryService.getByDocument(documentId),
        chapterService.getFullContent(documentId),
      ])
      setCoreInfoTree(coreRes.items)
      setSummaries(summaryRes.summaries)
      setFullContent(documentId, documentTitle ?? docTitle, fullContent.tree)

      router.push(`/documents/${documentId}`)
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : "应用失败")
    } finally {
      setApplying(false)
    }
  }, [documentId, documentTitle, docTitle, setCoreInfoTree, setSummaries, setFullContent, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">加载模板中...</p>
      </div>
    )
  }

  if (applyError && !templateId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-3">
        <p className="text-sm text-red-500">{applyError}</p>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:underline">返回</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航 */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
        <button
          onClick={() => router.push(`/documents/${documentId}`)}
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          ← 返回编辑器
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-sm font-medium text-gray-700 flex-1 truncate">
          应用模板 — {docTitle}
        </span>
      </header>

      {/* 步骤导航 */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-0 shrink-0">
        {STEPS.map((step, idx) => {
          const isActive = step.key === activeStep
          const isDone = idx < currentStepIndex
          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => setActiveStep(step.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm",
                  isActive && "bg-green-50 text-green-700",
                  !isActive && "text-gray-500 hover:text-gray-700"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition",
                  isActive && "border-green-500 bg-green-500 text-white",
                  isDone && "border-green-400 bg-green-100 text-green-600",
                  !isActive && !isDone && "border-gray-300 text-gray-400"
                )}>
                  {isDone ? "✓" : idx + 1}
                </div>
                <span className={cn("font-medium", isActive && "text-green-700")}>{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="w-12 h-px bg-gray-200 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-96">
          {/* 步骤说明 */}
          <div className="mb-5 pb-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              {STEPS[currentStepIndex].label}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {STEPS[currentStepIndex].desc}，可在应用前修改配置，修改将保存到文档的私有模板副本。
            </p>
          </div>

          {/* 步骤内容（复用模板编辑器组件） */}
          {templateId && (
            <>
              {activeStep === "core-info" && (
                <CoreInfoTemplateStep templateId={templateId} />
              )}
              {activeStep === "summary" && (
                <SummaryTemplateStep templateId={templateId} />
              )}
              {activeStep === "structure" && (
                <StructureTemplateStep templateId={templateId} />
              )}
            </>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={() => router.push(`/documents/${documentId}`)}
          className="h-9 px-4 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          取消
        </button>

        {applyError && (
          <p className="text-sm text-red-500 flex-1 text-center">{applyError}</p>
        )}

        <div className="flex items-center gap-2">
          {currentStepIndex > 0 && (
            <button
              onClick={handlePrev}
              disabled={applying}
              className="h-9 px-4 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              上一步
            </button>
          )}

          {!isLastStep ? (
            <button
              onClick={handleNext}
              className="h-9 px-5 rounded bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleApply}
              disabled={applying}
              className="h-9 px-5 rounded bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition"
            >
              {applying ? "应用中..." : "确认应用"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
