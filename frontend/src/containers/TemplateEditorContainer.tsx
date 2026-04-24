"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import BasicInfoStep from "@/components/template/BasicInfoStep"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { templateService } from "@/services/templateService"
import { cn } from "@/lib/utils"
import type { TemplateDependenciesResponse, TemplateDetail } from "@/types/api"

const PANEL_MIN_RATIOS = [18, 18, 24]
const HANDLE_WIDTH_PX = 16

interface TemplateEditorContainerProps {
  templateId?: string
}

export default function TemplateEditorContainer({ templateId }: TemplateEditorContainerProps) {
  const router = useRouter()
  const panelContainerRef = useRef<HTMLDivElement>(null)
  const resizeStateRef = useRef<{
    handleIndex: number
    startX: number
    startWidths: [number, number, number]
  } | null>(null)

  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(templateId ?? null)
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(!!templateId)
  const [error, setError] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<TemplateDependenciesResponse | null>(null)
  const [showBasicEditor, setShowBasicEditor] = useState(!templateId)
  const [panelWidths, setPanelWidths] = useState<[number, number, number]>([24, 28, 48])
  const [activeHandle, setActiveHandle] = useState<number | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const loadTemplate = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const detail = await templateService.get(id)
      setTemplate(detail)
      setCurrentTemplateId(detail.template_id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载模板失败")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDependencies = useCallback(async (id: string) => {
    try {
      const data = await templateService.getDependencies(id)
      setDependencies(data)
    } catch {
      setDependencies(null)
    }
  }, [])

  useEffect(() => {
    if (!templateId) return
    void loadTemplate(templateId)
  }, [loadTemplate, templateId])

  useEffect(() => {
    if (!currentTemplateId) return
    void loadDependencies(currentTemplateId)
  }, [currentTemplateId, loadDependencies])

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
    setSaveMessage("模板修改已保存")
    window.setTimeout(() => {
      setSaveMessage((current) => (current === "模板修改已保存" ? null : current))
    }, 2500)
  }, [])

  const handleBasicSaved = useCallback((saved: TemplateDetail) => {
    setTemplate(saved)
    setCurrentTemplateId(saved.template_id)
    setShowBasicEditor(false)
    if (!templateId) router.replace(`/admin/templates/${saved.template_id}`)
  }, [router, templateId])

  if (loading) {
    return (
      <div className="min-h-screen bg-template-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">加载模板中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-template-bg flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => router.push("/admin/templates")} className="text-sm text-gray-600 hover:underline">
          返回模板列表
        </button>
      </div>
    )
  }

  if (!currentTemplateId) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => router.push("/admin/templates")}
          className="inline-flex w-fit items-center rounded-md border border-template-border bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-template-hover"
        >
          ← 返回模板列表
        </button>
        <section className="rounded-2xl border border-template-border bg-white shadow-[0_8px_20px_rgba(90,80,60,0.08)]">
          <div className="border-b border-template-border-inner bg-template-card-header px-4 py-3">
            <h2 className="text-base font-semibold text-gray-800">新建模板</h2>
            <p className="mt-1 text-xs text-gray-500">先保存基础信息，随后进入三栏模板编辑页面。</p>
          </div>
          <div className="p-3">
            <BasicInfoStep
              templateId={null}
              initialData={null}
              onSaved={handleBasicSaved}
            />
          </div>
        </section>
      </div>
    )
  }

  const panels = [
    {
      key: "core-info",
      title: "核心信息模板",
      desc: "编辑模板的核心信息字段结构，并作为拖拽填充源。",
      accentClass: "bg-template-accent",
      children: (
        <CoreInfoTemplateStep
          templateId={currentTemplateId}
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
          templateId={currentTemplateId}
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
          templateId={currentTemplateId}
          stickyOutline
          dependencyItems={dependencies?.structure_templates ?? []}
        />
      ),
    },
  ] as const

  return (
    <div className="h-[calc(100vh-120px)] min-h-[680px] overflow-hidden rounded-2xl border border-template-border bg-template-bg flex flex-col">
      <header className="shrink-0 border-b border-template-border bg-template-bg-header/95 backdrop-blur">
        <div className="mx-auto flex flex-col gap-4 px-4 py-4 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/templates")}
                className="rounded-full border border-template-border px-3 py-1 text-sm text-gray-600 hover:bg-white transition"
              >
                ← 返回模板列表
              </button>
              <span className="hidden text-sm text-gray-400 xl:inline">/</span>
              <span className="truncate text-sm font-medium text-gray-700">模板编辑 - {template?.display_name ?? "未命名模板"}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              三个模板板块同时编辑。核心信息字段可直接拖到摘要模板或章节结构模板的来源框、内容模板和提示词框中自动填入。
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
            <button
              type="button"
              onClick={() => setShowBasicEditor((prev) => !prev)}
              className="h-10 rounded-full border border-template-accent bg-white px-5 text-sm font-medium text-template-accent hover:bg-template-accent-light transition"
            >
              {showBasicEditor ? "收起基础信息" : "编辑基础信息"}
            </button>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="h-10 rounded-full bg-template-accent px-5 text-sm font-medium text-white hover:bg-template-accent-hover disabled:opacity-50 transition"
            >
              {savingTemplate ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden px-3 py-4 lg:px-4">
        {showBasicEditor && (
          <section className="mb-3 rounded-2xl border border-template-border bg-white shadow-sm">
            <div className="border-b border-template-border-inner px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">基础信息</h3>
            </div>
            <div className="p-3">
              <BasicInfoStep
                templateId={currentTemplateId}
                initialData={template}
                onSaved={(saved) => {
                  setTemplate(saved)
                  setCurrentTemplateId(saved.template_id)
                }}
              />
            </div>
          </section>
        )}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
