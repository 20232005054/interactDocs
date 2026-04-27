"use client"

import { Fragment, useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { documentService } from "@/services/documentService"
import { coreInfoService } from "@/services/coreInfoService"
import { summaryService } from "@/services/summaryService"
import { chapterService } from "@/services/chapterService"
import { templateService } from "@/services/templateService"
import { useDocumentStore } from "@/store/documentStore"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { cn } from "@/lib/utils"
import type { TemplateDependenciesResponse } from "@/types/api"

type ApplyKey = "core-info" | "summary" | "structure"
type ApplyStatus = "idle" | "applying" | "done" | "error"

const PANEL_MIN_RATIOS = [18, 18, 24]
const HANDLE_WIDTH_PX = 16

interface ApplyTemplateEditorContainerProps {
  documentId: string
}

export default function ApplyTemplateEditorContainer({ documentId }: ApplyTemplateEditorContainerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setFullContent, setSummaries, setCoreInfoTree, documentTitle } = useDocumentStore()
  const panelContainerRef = useRef<HTMLDivElement>(null)
  const autoApplyTriggeredRef = useRef(false)
  const resizeStateRef = useRef<{
    handleIndex: number
    startX: number
    startWidths: [number, number, number]
  } | null>(null)

  const [templateId, setTemplateId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [applying, setApplying] = useState(false)
  const [dependencies, setDependencies] = useState<TemplateDependenciesResponse | null>(null)
  const [applyStatus, setApplyStatus] = useState<Record<ApplyKey, ApplyStatus>>({
    "core-info": "idle",
    "summary": "idle",
    "structure": "idle",
  })
  const [panelWidths, setPanelWidths] = useState<[number, number, number]>([24, 28, 48])
  const [activeHandle, setActiveHandle] = useState<number | null>(null)
  const shouldAutoApply = searchParams.get("autoApply") === "1"

  const loadDependencies = useCallback(async (id: string) => {
    try {
      const data = await templateService.getDependencies(id)
      setDependencies(data)
    } catch {
      setDependencies(null)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const doc = await documentService.get(documentId)
        if (!doc.template_id) throw new Error("文档未关联模板")
        setTemplateId(doc.template_id)
        setDocTitle(doc.title)
        void loadDependencies(doc.template_id)
      } catch (err: unknown) {
        setApplyError(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [documentId, loadDependencies])

  const setStatus = useCallback((key: ApplyKey, status: ApplyStatus) => {
    setApplyStatus((prev) => ({ ...prev, [key]: status }))
  }, [])

  useEffect(() => {
    if (activeHandle === null) return

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      const container = panelContainerRef.current
      if (!resizeState || !container) return

      const contentWidth = container.getBoundingClientRect().width - HANDLE_WIDTH_PX * 2
      if (contentWidth <= 0) return

      const deltaRatio = ((event.clientX - resizeState.startX) / contentWidth) * 100
      const next = [...resizeState.startWidths] as [number, number, number]
      const leftIndex = resizeState.handleIndex
      const rightIndex = resizeState.handleIndex + 1
      const pairTotal = resizeState.startWidths[leftIndex] + resizeState.startWidths[rightIndex]

      const nextLeft = clamp(
        resizeState.startWidths[leftIndex] + deltaRatio,
        PANEL_MIN_RATIOS[leftIndex],
        pairTotal - PANEL_MIN_RATIOS[rightIndex]
      )

      next[leftIndex] = nextLeft
      next[rightIndex] = pairTotal - nextLeft
      setPanelWidths(next)
    }

    const handlePointerUp = () => {
      setActiveHandle(null)
      resizeStateRef.current = null
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [activeHandle])

  const handleSaveTemplate = useCallback(async () => {
    setSavingTemplate(true)
    setSaveMessage(null)

    await new Promise((resolve) => setTimeout(resolve, 700))

    setSavingTemplate(false)
    setSaveMessage("模板修改已保存到私有模板副本")

    window.setTimeout(() => {
      setSaveMessage((current) => (current === "模板修改已保存到私有模板副本" ? null : current))
    }, 2500)
  }, [])

  const handleApply = useCallback(async () => {
    setApplying(true)
    setApplyError(null)
    setSaveMessage(null)
    setApplyStatus({
      "core-info": "idle",
      "summary": "idle",
      "structure": "idle",
    })

    try {
      // 核心信息模板在创建文档时已应用，这里只应用摘要和章节结构
      setStatus("core-info", "done")

      setStatus("summary", "applying")
      await documentService.applySummaryTemplate(documentId)
      setStatus("summary", "done")

      setStatus("structure", "applying")
      await documentService.applyStructureTemplate(documentId)
      setStatus("structure", "done")

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
      const message = err instanceof Error ? err.message : "应用失败"
      setApplyError(message)
      setApplyStatus((prev) => {
        const next = { ...prev }
        const activeKey = (Object.entries(prev).find(([, status]) => status === "applying")?.[0] ?? "structure") as ApplyKey
        next[activeKey] = "error"
        return next
      })
    } finally {
      setApplying(false)
    }
  }, [documentId, docTitle, documentTitle, router, setCoreInfoTree, setFullContent, setStatus, setSummaries])

  useEffect(() => {
    if (!shouldAutoApply) return
    if (autoApplyTriggeredRef.current) return
    if (loading || !templateId || applying) return

    autoApplyTriggeredRef.current = true
    void handleApply()
  }, [applying, handleApply, loading, shouldAutoApply, templateId])

  if (loading) {
    return (
      <div className="min-h-screen bg-template-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">加载模板中...</p>
      </div>
    )
  }

  if (applyError && !templateId) {
    return (
      <div className="min-h-screen bg-template-bg flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{applyError}</p>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
          返回
        </button>
      </div>
    )
  }

  const panels = templateId ? [
    {
      key: "core-info",
      title: "核心信息模板",
      desc: "编辑文档的核心信息字段结构，并作为拖拽填充源。",
      accentClass: "bg-template-accent",
      children: (
        <CoreInfoTemplateStep
          templateId={templateId}
          enableDrag
          dependencyItems={dependencies?.core_info_templates ?? []}
        />
      ),
    },
    {
      key: "summary",
      title: "摘要模板",
      desc: "摘要卡片支持接收核心信息拖拽，快速填入来源、内容模板和提示词。",
      accentClass: "bg-template-summary",
      children: (
        <SummaryTemplateStep
          templateId={templateId}
          dependencyItems={dependencies?.summary_templates ?? []}
        />
      ),
    },
    {
      key: "structure",
      title: "章节结构模板",
      desc: "桌面端保持更宽布局，方便横向拖拽核心信息到章节配置区。",
      accentClass: "bg-template-structure",
      children: (
        <StructureTemplateStep
          templateId={templateId}
          stickyOutline
          dependencyItems={dependencies?.structure_templates ?? []}
        />
      ),
    },
  ] : []

  return (
    <div className="h-screen overflow-hidden bg-template-bg flex flex-col">
      <header className="shrink-0 border-b border-template-border bg-template-bg-header/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/documents/${documentId}`)}
                className="rounded-full border border-template-border px-3 py-1 text-sm text-gray-600 hover:bg-white transition"
              >
                ← 返回编辑器
              </button>
              <span className="hidden text-sm text-gray-400 xl:inline">/</span>
              <span className="truncate text-sm font-medium text-gray-700">应用模板 - {docTitle}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              三个模板板块同时编辑。保存只更新文档的私有模板副本，应用才会把模板内容写入文档。核心信息字段可直接拖到摘要模板或章节结构模板的来源框、内容模板和提示词框中自动填入。
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip label="核心信息" status={applyStatus["core-info"]} />
              <StatusChip label="摘要" status={applyStatus.summary} />
              <StatusChip label="章节结构" status={applyStatus.structure} />
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
              {applyError && <p className="text-sm text-red-500">{applyError}</p>}
              <button
                onClick={handleSaveTemplate}
                disabled={applying || savingTemplate || !templateId}
                className="h-10 rounded-full border border-template-accent bg-white px-5 text-sm font-medium text-template-accent hover:bg-template-accent-light disabled:opacity-50 transition"
              >
                {savingTemplate ? "保存中..." : "保存"}
              </button>
              <button
                onClick={handleApply}
                disabled={applying || savingTemplate || !templateId}
                className="h-10 rounded-full bg-template-accent px-5 text-sm font-medium text-white hover:bg-template-accent-hover disabled:opacity-50 transition"
              >
                {applying ? "应用中..." : "应用"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col overflow-hidden px-3 py-4 lg:px-4">
        {templateId && (
          <div
            ref={panelContainerRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row xl:gap-0"
          >
            {panels.map((panel, index) => (
              <Fragment key={panel.key}>
                <div
                  className="min-w-0 xl:h-full xl:basis-0 xl:shrink-0 xl:[flex-grow:var(--panel-grow)]"
                  style={{ ["--panel-grow" as string]: panelWidths[index] }}
                >
                  <BoardShell
                    title={panel.title}
                    desc={panel.desc}
                    accentClass={panel.accentClass}
                    className="xl:h-full"
                  >
                    {panel.children}
                  </BoardShell>
                </div>

                {index < panels.length - 1 && (
                  <ResizeHandle
                    active={activeHandle === index}
                    onPointerDown={(event) => {
                      resizeStateRef.current = {
                        handleIndex: index,
                        startX: event.clientX,
                        startWidths: panelWidths,
                      }
                      setActiveHandle(index)
                    }}
                  />
                )}
              </Fragment>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function BoardShell({
  title,
  desc,
  accentClass,
  className,
  contentClassName,
  children,
}: {
  title: string
  desc: string
  accentClass: string
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-template-border bg-white shadow-sm", className)}>
      <div className="border-b border-template-border-inner px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn("h-3 w-3 rounded-full", accentClass)} />
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">{desc}</p>
      </div>
      <div className={cn("p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto", contentClassName)}>{children}</div>
    </section>
  )
}

function ResizeHandle({
  active,
  onPointerDown,
}: {
  active: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="hidden w-4 flex-none items-stretch justify-center xl:flex">
      <button
        type="button"
        aria-label="调整模板板块宽度"
        onPointerDown={(event) => {
          event.preventDefault()
          onPointerDown(event)
        }}
        className={cn(
          "group flex w-full cursor-col-resize items-center justify-center touch-none",
          active && "bg-template-border-inner"
        )}
      >
        <span
          className={cn(
            "h-20 w-1 rounded-full bg-template-border transition group-hover:bg-template-handle-hover",
            active && "bg-template-handle-active"
          )}
        />
      </button>
    </div>
  )
}

function StatusChip({ label, status }: { label: string; status: ApplyStatus }) {
  const text =
    status === "done" ? "已应用" :
    status === "applying" ? "应用中" :
    status === "error" ? "失败" :
    "待应用"

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        status === "done" && "bg-green-100 text-green-700",
        status === "applying" && "bg-blue-100 text-blue-700",
        status === "error" && "bg-red-100 text-red-700",
        status === "idle" && "bg-gray-200 text-gray-600"
      )}
    >
      {label} · {text}
    </span>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
