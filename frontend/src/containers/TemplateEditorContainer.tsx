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
import { toastError } from "@/hooks/useToast"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { templateService } from "@/services/templateService"
import { literatureService } from "@/services/literatureService"
import { cn } from "@/lib/utils"
import type { Literature, TemplateDependenciesResponse, TemplateDetail } from "@/types/api"

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
  const [showLiterature, setShowLiterature] = useState(false)
  const [boundLiterature, setBoundLiterature] = useState<Literature[]>([])
  const [allLiterature, setAllLiterature] = useState<Literature[]>([])
  const [litLoading, setLitLoading] = useState(false)
  const [litSearch, setLitSearch] = useState("")
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
    if (!currentTemplateId) return
    void loadBoundLiterature(currentTemplateId)
  }, [currentTemplateId, loadBoundLiterature])

  // 展开文献面板时懒加载知识库列表
  useEffect(() => {
    if (!showLiterature || allLiterature.length > 0) return
    setLitLoading(true)
    literatureService.list().then(res => {
      setAllLiterature(res.items)
    }).catch(() => {}).finally(() => setLitLoading(false))
  }, [showLiterature, allLiterature.length])

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
              onClick={() => setShowLiterature((prev) => !prev)}
              className="h-10 rounded-full border border-template-border bg-white px-5 text-sm font-medium text-gray-600 hover:bg-template-hover transition"
            >
              {showLiterature ? "收起文献" : "管理文献"}
            </button>
            {currentTemplateId && template && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await templateService.exportJson(currentTemplateId, template.display_name)
                  } catch (err: unknown) {
                    toastError(err instanceof Error ? err.message : "导出失败")
                  }
                }}
                className="h-10 rounded-full border border-template-border bg-white px-5 text-sm font-medium text-gray-600 hover:bg-template-hover transition"
              >
                导出 JSON
              </button>
            )}
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

        {showLiterature && currentTemplateId && (
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
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await literatureService.unbind(currentTemplateId, lit.literature_id)
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
                            </div>
                            {isBound ? (
                              <span className="shrink-0 text-xs text-green-600 font-medium">已绑定</span>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await literatureService.bind(currentTemplateId, lit.literature_id)
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

        <div
          ref={panelContainerRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row xl:gap-0"
        >
          {panels.map((panel, index) => (
            <Fragment key={panel.key}>
              {/* CSS 变量：使用 flex-grow 实现可调整宽度的面板布局，通过 CSS 变量传递动态计算的比例值 */}
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
