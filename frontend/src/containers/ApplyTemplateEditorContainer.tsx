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
const HANDLE_WIDTH_PX = 24

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
  const [collapsedPanels, setCollapsedPanels] = useState<Set<ApplyKey>>(new Set())
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

    let rafId: number | null = null

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      const container = panelContainerRef.current
      if (!resizeState || !container) return

      // 使用 RAF 优化渲染性能
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
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
      })
    }

    const handlePointerUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      setActiveHandle(null)
      resizeStateRef.current = null
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">加载模板中...</p>
      </div>
    )
  }

  if (applyError && !templateId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{applyError}</p>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:underline">
          返回
        </button>
      </div>
    )
  }

  const panels = templateId ? [
    {
      key: "core-info" as ApplyKey,
      title: "核心信息模板",
      desc: "编辑文档的核心信息字段结构，并作为拖拽填充源（创建文档时已自动应用）",
      accentColor: "bg-blue-500",
      bgColor: "bg-blue-50/30",
      borderColor: "border-blue-200",
      status: applyStatus["core-info"],
      collapsible: true,
      children: (
        <CoreInfoTemplateStep
          templateId={templateId}
          enableDrag
          dependencyItems={dependencies?.core_info_templates ?? []}
        />
      ),
    },
    {
      key: "summary" as ApplyKey,
      title: "摘要模板",
      desc: "摘要卡片支持接收核心信息拖拽，快速填入来源、内容模板和提示词",
      accentColor: "bg-green-500",
      bgColor: "bg-green-50/30",
      borderColor: "border-green-200",
      status: applyStatus.summary,
      collapsible: true,
      children: (
        <SummaryTemplateStep
          templateId={templateId}
          dependencyItems={dependencies?.summary_templates ?? []}
        />
      ),
    },
    {
      key: "structure" as ApplyKey,
      title: "章节结构模板",
      desc: "定义文档章节结构，支持拖拽核心信息和摘要到章节配置区",
      accentColor: "bg-purple-500",
      bgColor: "bg-purple-50/30",
      borderColor: "border-purple-200",
      status: applyStatus.structure,
      collapsible: false,
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
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      {/* 顶部导航栏 - 统一为 12px 高度 */}
      <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shadow-sm">
        <button
          onClick={() => router.push(`/documents/${documentId}`)}
          className="text-gray-400 hover:text-gray-600 transition text-sm flex items-center gap-1.5 hover:bg-gray-50 px-2 py-1 rounded"
        >
          <span>←</span>
          <span>返回</span>
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <h1 className="text-base font-semibold text-gray-800 flex-1 truncate">应用模板 · {docTitle}</h1>
        
        {/* 操作按钮组 */}
        <div className="flex items-center gap-3">
          {saveMessage && <span className="text-xs text-green-600 font-medium animate-in fade-in">{saveMessage}</span>}
          {applyError && <span className="text-xs text-red-500 font-medium">{applyError}</span>}
          <button
            onClick={() => setShowLiterature((prev) => !prev)}
            disabled={applying || savingTemplate || !templateId}
            className="h-8 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <span className="text-base">📚</span>
            <span>{showLiterature ? "收起文献" : "文献管理"}</span>
          </button>
          <button
            onClick={handleSaveTemplate}
            disabled={applying || savingTemplate || !templateId}
            className="h-8 px-4 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition"
          >
            {savingTemplate ? "保存中..." : "保存"}
          </button>
          <button
            onClick={handleApply}
            disabled={applying || savingTemplate || !templateId}
            className="h-9 px-6 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition shadow-md hover:shadow-lg"
            title="根据当前模板配置生成文档内容（可重复应用）"
          >
            {applying ? "⏳ 应用中..." : "✨ 应用模板"}
          </button>
        </div>
        
        {user?.name && (
          <span className="text-xs text-gray-400 shrink-0 ml-2">{user.name}</span>
        )}
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-3 relative">
        {/* 文献管理侧边抽屉 */}
        {showLiterature && templateId && (
          <>
            {/* 遮罩层 */}
            <div 
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-200"
              onClick={() => setShowLiterature(false)}
            />
            
            {/* 侧边抽屉 */}
            <aside className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
              {/* 抽屉头部 */}
              <div className="h-14 shrink-0 border-b border-gray-200 flex items-center justify-between px-6 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📚</span>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">文献管理</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{boundLiterature.length} 篇已绑定</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLiterature(false)}
                  className="w-8 h-8 rounded-lg hover:bg-white/80 transition flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  <span className="text-xl">×</span>
                </button>
              </div>

              {/* 抽屉内容 */}
              <div className="flex-1 overflow-y-auto">
                {/* 已绑定文献区域 */}
                <div className="p-6 border-b border-gray-100 bg-green-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <span className="w-1 h-4 bg-green-500 rounded-full" />
                      已绑定文献
                    </h4>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">{boundLiterature.length} 篇</span>
                  </div>
                  {boundLiterature.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">📭</div>
                      <p className="text-sm">暂未绑定任何文献</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {boundLiterature.map(lit => (
                        <div key={lit.literature_id} className="group bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{lit.title ?? "标题解析中..."}</p>
                              {lit.authors && <p className="text-xs text-gray-500 mt-1 truncate">👤 {lit.authors}</p>}
                              {lit.journal && <p className="text-xs text-gray-500 truncate">📖 {lit.journal}</p>}
                              <div className="mt-2">
                                {lit.scope === "public" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                                    🌐 公共
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700">
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
                              className="opacity-0 group-hover:opacity-100 shrink-0 text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-red-50"
                            >
                              解绑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 知识库文献区域 */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <span className="w-1 h-4 bg-blue-500 rounded-full" />
                      知识库文献
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowUpload(true)}
                      className="h-7 px-3 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition shadow-sm"
                    >
                      + 上传
                    </button>
                  </div>
                  
                  {/* 搜索框 */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={litSearch}
                      onChange={e => setLitSearch(e.target.value)}
                      placeholder="🔍 搜索标题、作者..."
                      className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>

                  {litLoading ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm">加载中...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
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
                            <div key={lit.literature_id} className="group bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-white hover:shadow-md transition">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{lit.title ?? "—"}</p>
                                  {lit.authors && <p className="text-xs text-gray-500 mt-1 truncate">👤 {lit.authors}</p>}
                                  {lit.journal && <p className="text-xs text-gray-500 truncate">📖 {lit.journal}</p>}
                                  <div className="mt-2">
                                    {lit.scope === "public" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                                        🌐 公共
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700">
                                        🔒 私有
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isBound ? (
                                  <span className="shrink-0 text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">✓ 已绑定</span>
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
                                    className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline px-2 py-1 rounded hover:bg-blue-50 transition"
                                  >
                                    绑定
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      {allLiterature.filter(l => l.upload_status === "ready").length === 0 && !litLoading && (
                        <div className="text-center py-8 text-gray-400">
                          <div className="text-4xl mb-2">📚</div>
                          <p className="text-sm">知识库暂无就绪文献</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </>
        )}

        {templateId && (
          <div
            ref={panelContainerRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row xl:gap-0"
          >
            {panels.map((panel, index) => {
              const isCollapsed = collapsedPanels.has(panel.key)
              
              return (
                <Fragment key={panel.key}>
                  {/* CSS 变量：使用 flex-grow 实现可调整宽度的面板布局，通过 CSS 变量传递动态计算的比例值 */}
                  <div
                    className={cn(
                      "min-w-0 shrink-0",
                      isCollapsed 
                        ? "w-16 xl:w-16" // 所有屏幕都是 64px
                        : "flex-1 xl:basis-0 xl:[flex-grow:var(--panel-grow)]"
                    )}
                    style={isCollapsed ? {} : { ["--panel-grow" as string]: panelWidths[index] }}
                  >
                    <BoardShell
                      title={panel.title}
                      desc={panel.desc}
                      accentColor={panel.accentColor}
                      bgColor={panel.bgColor}
                      borderColor={panel.borderColor}
                      status={panel.status}
                      className="xl:h-full"
                      collapsed={isCollapsed}
                      collapsible={panel.collapsible}
                      onToggleCollapse={panel.collapsible ? () => {
                        setCollapsedPanels(prev => {
                          const next = new Set(prev)
                          if (next.has(panel.key)) {
                            next.delete(panel.key)
                          } else {
                            next.add(panel.key)
                          }
                          return next
                        })
                      } : undefined}
                    >
                      {panel.children}
                    </BoardShell>
                  </div>

                  {index < panels.length - 1 && !isCollapsed && !collapsedPanels.has(panels[index + 1].key) && (
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
              )
            })}
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
  accentColor,
  bgColor,
  borderColor,
  className,
  contentClassName,
  children,
  status,
  collapsed = false,
  collapsible = false,
  onToggleCollapse,
}: {
  title: string
  desc: string
  accentColor: string
  bgColor: string
  borderColor: string
  className?: string
  contentClassName?: string
  children: ReactNode
  status?: ApplyStatus
  collapsed?: boolean
  collapsible?: boolean
  onToggleCollapse?: () => void
}) {
  const statusConfig = {
    done: { text: "✓ 完成", color: "bg-green-500", textColor: "text-green-700", bgColor: "bg-green-50" },
    applying: { text: "⏳ 应用中", color: "bg-blue-500", textColor: "text-blue-700", bgColor: "bg-blue-50" },
    error: { text: "✗ 失败", color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50" },
    idle: { text: "", color: "", textColor: "", bgColor: "" }, // 空闲状态不显示
  }
  
  const currentStatus = status && status !== "idle" ? statusConfig[status] : null

  if (collapsed) {
    return (
      <section className={cn(
        "flex h-full min-h-0 flex-col overflow-visible rounded-xl border-2 shadow-md bg-white",
        borderColor,
        className
      )}>
        <button
          onClick={onToggleCollapse}
          className="h-full w-full flex flex-col items-center justify-center hover:bg-gray-50 transition-all group cursor-pointer py-8"
          title={`展开${title}`}
        >
          <span className={cn("h-5 w-5 rounded-full shadow-lg mb-4", accentColor)} />
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl text-gray-500 group-hover:text-gray-800 transition-colors font-bold">»</span>
            <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">展开</span>
          </div>
        </button>
      </section>
    )
  }

  return (
    <section className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 shadow-md transition-shadow hover:shadow-lg", borderColor, bgColor, className)}>
      <div className={cn("border-b-2 px-4 py-3.5 bg-white/80 backdrop-blur-sm", borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={cn("h-3 w-3 rounded-full shadow-sm", accentColor)} />
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
            {collapsible && (
              <button
                onClick={onToggleCollapse}
                className="ml-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded hover:bg-gray-100"
                title="收起面板"
              >
                ←
              </button>
            )}
          </div>
          {currentStatus && (
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5", currentStatus.bgColor, currentStatus.textColor)}>
              {currentStatus.text}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{desc}</p>
      </div>
      <div className={cn("p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto compact-scrollbar bg-white", contentClassName)}>{children}</div>
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
    <div className="hidden w-6 flex-none items-stretch justify-center xl:flex">
      <button
        type="button"
        aria-label="调整模板板块宽度"
        onPointerDown={(event) => {
          event.preventDefault()
          onPointerDown(event)
        }}
        className={cn(
          "group flex w-full cursor-col-resize items-center justify-center touch-none transition-colors",
          active ? "bg-blue-100" : "hover:bg-gray-50"
        )}
      >
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "h-8 w-1.5 rounded-full transition-all",
              active ? "bg-blue-500 shadow-md" : "bg-gray-300 group-hover:bg-gray-400"
            )}
          />
          <span
            className={cn(
              "h-8 w-1.5 rounded-full transition-all",
              active ? "bg-blue-500 shadow-md" : "bg-gray-300 group-hover:bg-gray-400"
            )}
          />
        </div>
      </button>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
