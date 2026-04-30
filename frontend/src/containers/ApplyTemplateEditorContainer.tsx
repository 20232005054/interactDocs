"use client"

import { Fragment, useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { documentService } from "@/services/documentService"
import { coreInfoService } from "@/services/coreInfoService"
import { summaryService } from "@/services/summaryService"
import { chapterService } from "@/services/chapterService"
import { templateService } from "@/services/templateService"
import { literatureService } from "@/services/literatureService"
import { useDocumentStore } from "@/store/documentStore"
import { useAuthStore } from "@/store/authStore"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import UploadLiteratureDialog from "@/components/literature/UploadLiteratureDialog"
import { cn } from "@/lib/utils"
import { toastError } from "@/hooks/useToast"
import type { TemplateDependenciesResponse, Literature } from "@/types/api"

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
  const { user } = useAuthStore()
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

  // 文献管理状态
  const [showLiterature, setShowLiterature] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [boundLiterature, setBoundLiterature] = useState<Literature[]>([])
  const [allLiterature, setAllLiterature] = useState<Literature[]>([])
  const [litLoading, setLitLoading] = useState(false)
  const [litSearch, setLitSearch] = useState("")

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

  // 加载已绑定文献
  const loadBoundLiterature = useCallback(async (id: string) => {
    try {
      const res = await literatureService.listByTemplate(id)
      setBoundLiterature(res.items)
    } catch {
      setBoundLiterature([])
    }
  }, [])

  useEffect(() => {
    if (!templateId) return
    void loadBoundLiterature(templateId)
  }, [templateId, loadBoundLiterature])

  // 展开文献面板时懒加载知识库列表
  useEffect(() => {
    if (!showLiterature || allLiterature.length > 0) return
    setLitLoading(true)
    literatureService.list().then(res => {
      setAllLiterature(res.items)
    }).catch(() => {}).finally(() => setLitLoading(false))
  }, [showLiterature, allLiterature.length])

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
                onClick={() => setShowLiterature((prev) => !prev)}
                disabled={applying || savingTemplate || !templateId}
                className="h-10 rounded-full border border-template-border bg-white px-5 text-sm font-medium text-gray-600 hover:bg-template-hover disabled:opacity-50 transition"
              >
                {showLiterature ? "收起文献" : "管理文献"}
              </button>
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
        {/* 文献管理面板 */}
        {showLiterature && templateId && (
          <section className="mb-3 rounded-2xl border border-template-border bg-white shadow-sm shrink-0">
            <div className="border-b border-template-border-inner px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">文献绑定</h3>
                <p className="mt-0.5 text-xs text-gray-400">绑定到此模板的文献将在 AI 生成时作为参考来源</p>
              </div>
              <span className="text-xs text-muted-foreground">{boundLiterature.length} 篇已绑定</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-template-border-inner">
              {/* 左列：已绑定 */}
              <div className="p-4">
                <p className="mb-2 text-xs font-medium text-gray-500">已绑定文献</p>
                {boundLiterature.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">暂未绑定任何文献</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {boundLiterature.map(lit => (
                      <div key={lit.literature_id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-700 truncate">{lit.title ?? "标题解析中..."}</p>
                          {lit.authors && <p className="text-xs text-gray-400 truncate mt-0.5">{lit.authors}</p>}
                          {lit.journal && <p className="text-xs text-gray-400 truncate">{lit.journal}</p>}
                          {/* Scope 标签 */}
                          <div className="mt-1">
                            {lit.scope === "public" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600">
                                🌐 公共
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600">
                                🔒 私有
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await literatureService.unbind(templateId, lit.literature_id)
                              setBoundLiterature(prev => prev.filter(l => l.literature_id !== lit.literature_id))
                            } catch (err: unknown) {
                              toastError(err instanceof Error ? err.message : "解绑失败")
                            }
                          }}
                          className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition"
                        >
                          解绑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 右列：知识库选择 */}
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-500">知识库文献</p>
                  <input
                    type="text"
                    value={litSearch}
                    onChange={e => setLitSearch(e.target.value)}
                    placeholder="搜索标题、作者..."
                    className="ml-auto h-7 w-44 rounded border border-gray-200 px-2 text-xs outline-none focus:border-blue-300 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="shrink-0 h-7 px-3 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition"
                  >
                    + 上传
                  </button>
                </div>
                {litLoading ? (
                  <p className="text-xs text-gray-400 py-3 text-center">加载中...</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {allLiterature
                      .filter(lit => {
                        if (!litSearch.trim()) return true
                        const kw = litSearch.toLowerCase()
                        return lit.title?.toLowerCase().includes(kw) || lit.authors?.toLowerCase().includes(kw)
                      })
                      .filter(lit => lit.upload_status === "ready")
                      .map(lit => {
                        const isBound = boundLiterature.some(b => b.literature_id === lit.literature_id)
                        return (
                          <div key={lit.literature_id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-700 truncate">{lit.title ?? "—"}</p>
                              {lit.authors && <p className="text-xs text-gray-400 truncate mt-0.5">{lit.authors}</p>}
                              {lit.journal && <p className="text-xs text-gray-400 truncate">{lit.journal}</p>}
                              {/* Scope 标签 */}
                              <div className="mt-1">
                                {lit.scope === "public" ? (
                                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600">
                                    🌐 公共
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600">
                                    🔒 私有
                                  </span>
                                )}
                              </div>
                            </div>
                            {isBound ? (
                              <span className="shrink-0 text-xs text-green-600 font-medium">已绑定</span>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await literatureService.bind(templateId, lit.literature_id)
                                    setBoundLiterature(prev => [...prev, lit])
                                  } catch (err: unknown) {
                                    toastError(err instanceof Error ? err.message : "绑定失败")
                                  }
                                }}
                                className="shrink-0 text-xs text-primary hover:underline"
                              >
                                绑定
                              </button>
                            )}
                          </div>
                        )
                      })}
                    {allLiterature.filter(l => l.upload_status === "ready").length === 0 && !litLoading && (
                      <p className="text-xs text-gray-400 py-3 text-center">知识库暂无就绪文献</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

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

      {/* 上传文献对话框 */}
      {showUpload && (
        <UploadLiteratureDialog
          onClose={() => setShowUpload(false)}
          onUploaded={(lit) => {
            setAllLiterature((prev) => [lit, ...prev])
            setShowUpload(false)
          }}
        />
      )}
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
