"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileText, FileEdit, MessageSquare, BookOpen, ArrowLeft, Wand2, RefreshCw, Upload, Download } from "lucide-react"
import { chapterService } from "@/services/chapterService"
import { summaryService } from "@/services/summaryService"
import { coreInfoService } from "@/services/coreInfoService"
import { documentService } from "@/services/documentService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore, type RightPanelTab } from "@/store/editorStore"
import InputDialog from "@/components/ui/InputDialog"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { toastError, toastSuccess } from "@/hooks/useToast"
import { useChatStore } from "@/store/chatStore"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import ChapterTree from "@/components/editor/ChapterTree"
import DocumentBody from "@/components/editor/DocumentBody"
import CoreInfoPanel from "@/components/editor/CoreInfoPanel"
import SummaryPanel from "@/components/editor/SummaryPanel"
import AIChatPanel from "@/components/editor/AIChatPanel"
import CitationsPanel from "@/components/editor/CitationsPanel"
import { useDocumentSSE } from "@/hooks/useDocumentSSE"

interface DocumentEditorContainerProps {
  documentId: string
}

export default function DocumentEditorContainer({ documentId }: DocumentEditorContainerProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { setFullContent, setSummaries, setCoreInfoTree, reset, documentTitle, tree } = useDocumentStore()
  const { rightPanelTab, setRightPanelTab } = useEditorStore()
  const resetChat = useChatStore((state) => state.reset)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(420) // 默认 420px
  const [isResizing, setIsResizing] = useState(false)
  const [refreshingContent, setRefreshingContent] = useState(false) // 内容刷新状态

  // SSE 订阅文档变更事件
  useDocumentSSE({ documentId, enabled: !loading && !error })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fullContent, summaryRes, coreInfoRes, docDetail] = await Promise.all([
        chapterService.getFullContent(documentId),
        summaryService.getByDocument(documentId),
        coreInfoService.getByDocument(documentId),
        documentService.get(documentId),
      ])
      setFullContent(documentId, docDetail.title, fullContent.tree)
      setSummaries(summaryRes.summaries)
      setCoreInfoTree(coreInfoRes.items)
      setTemplateId(docDetail.template_id ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [documentId, setFullContent, setSummaries, setCoreInfoTree])

  const refreshEditorContent = useCallback(async () => {
    const snapshotBefore = JSON.stringify(tree)
    const retryDelaysMs = [150, 450, 900, 1500, 2200]

    try {
      for (let index = 0; index < retryDelaysMs.length; index += 1) {
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[index]))
        }

        const fullContent = await chapterService.getFullContent(documentId)
        const nextSnapshot = JSON.stringify(fullContent.tree)
        setFullContent(documentId, documentTitle ?? "", fullContent.tree)

        // 后端核心信息/摘要保存后会异步联动正文，轮询直到检测到内容变化。
        if (nextSnapshot !== snapshotBefore) {
          return
        }
      }
    } catch {
      // 静默失败：SSE 事件会兜底同步最新内容，不阻断用户操作
    }
  }, [documentId, documentTitle, setFullContent, tree])

  // 轻量级刷新：只刷新章节树，不重新加载整个页面
  const refreshChapterTree = useCallback(async () => {
    setRefreshingContent(true)
    try {
      const fullContent = await chapterService.getFullContent(documentId)
      setFullContent(documentId, documentTitle ?? "", fullContent.tree)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "刷新失败")
    } finally {
      setRefreshingContent(false)
    }
  }, [documentId, documentTitle, setFullContent])

  useEffect(() => {
    resetChat()
    load()
    return () => {
      reset()
      resetChat()
    }
  }, [load, reset, resetChat])

  // 拖动调整右侧面板宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // 限制宽度范围：最小 320px，最大 800px
      setRightPanelWidth(Math.max(320, Math.min(800, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const tabs: { key: RightPanelTab; label: string; icon: typeof FileText }[] = [
    { key: "core-info", label: "核心信息", icon: FileText },
    { key: "summary", label: "摘要", icon: FileEdit },
    { key: "chat", label: "AI 对话", icon: MessageSquare },
    { key: "citations", label: "参考文献", icon: BookOpen },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <EditorHeader title="加载中..." onBack={() => router.push("/documents")} userName={user?.name} templateId={null} documentId={documentId} />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-200 bg-white animate-pulse" />
          <div className="flex-1 bg-white animate-pulse" />
          <div className="w-80 border-l border-gray-200 bg-white animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <EditorHeader title="加载失败" onBack={() => router.push("/documents")} userName={user?.name} templateId={null} documentId={documentId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={load} className="px-4 py-2 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 transition">
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶部导航 */}
      <EditorHeader
        title={documentTitle ?? ""}
        onBack={() => router.push("/documents")}
        userName={user?.name}
        onApplyTemplate={() => {
          if (templateId) router.push(`/documents/${documentId}/apply-template`)
        }}
        templateId={templateId}
        documentId={documentId}
      />

      {/* 三栏主体：左目录 + 中编辑 + 右信息 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：章节树（可折叠） */}
        {!leftPanelCollapsed && (
          <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden relative">
            <ChapterTree documentId={documentId} onReload={load} onRefreshContent={refreshChapterTree} />
            {/* 折叠按钮 */}
            <button
              type="button"
              onClick={() => setLeftPanelCollapsed(true)}
              className="absolute right-0 top-1/2 z-20 translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition"
              title="收起目录"
              aria-label="收起目录"
            >
              ⟨
            </button>
          </aside>
        )}

        {/* 左侧折叠后的展开按钮 */}
        {leftPanelCollapsed && (
          <button
            type="button"
            onClick={() => setLeftPanelCollapsed(false)}
            className="w-8 shrink-0 border-r border-gray-200 bg-white hover:bg-gray-50 transition flex items-center justify-center text-gray-400 hover:text-gray-600"
            title="展开目录"
            aria-label="展开目录"
          >
            <span className="text-xs">⟩</span>
          </button>
        )}

        {/* 中间：主编辑区（视觉中心） */}
        <main className="flex-1 overflow-hidden bg-white relative">
          {/* 刷新加载动画 */}
          {refreshingContent && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 bg-white rounded-lg shadow-lg px-6 py-4 border border-gray-100">
                <div className="relative">
                  <div className="w-10 h-10 border-4 border-blue-100 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm font-medium text-gray-700">更新章节顺序中...</span>
              </div>
            </div>
          )}
          <div className="h-full overflow-y-auto">
            <DocumentBody onReload={load} />
          </div>
        </main>

        {/* 右侧：信息面板（可折叠、可拖动调整宽度） */}
        {!rightPanelCollapsed && (
          <aside 
            className="shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden relative"
            style={{ width: `${rightPanelWidth}px` }}
          >
            {/* 拖动手柄 */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition z-30",
                isResizing && "bg-blue-400"
              )}
              onMouseDown={handleMouseDown}
            />
            
            {/* Tab 切换 */}
            <div className="flex border-b border-gray-200 shrink-0">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setRightPanelTab(tab.key)}
                    className={cn(
                      "flex-1 py-3 px-2 text-xs font-medium transition border-b-2 flex items-center justify-center gap-1.5",
                      rightPanelTab === tab.key
                        ? "border-blue-500 text-blue-600 bg-blue-50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {rightPanelTab === "core-info" && (
                <div className="h-full overflow-y-auto compact-scrollbar">
                  <CoreInfoPanel onAfterSave={refreshEditorContent} />
                </div>
              )}
              
              {rightPanelTab === "summary" && (
                <div className="h-full overflow-y-auto compact-scrollbar">
                  <SummaryPanel onAfterSave={refreshEditorContent} />
                </div>
              )}
              
              {rightPanelTab === "chat" && (
                <div className="h-full overflow-hidden">
                  <AIChatPanel documentId={documentId} onReload={load} />
                </div>
              )}
              
              {rightPanelTab === "citations" && (
                <div className="h-full overflow-y-auto compact-scrollbar">
                  <CitationsPanel documentId={documentId} />
                </div>
              )}
            </div>

            {/* 折叠按钮 */}
            <button
              type="button"
              onClick={() => setRightPanelCollapsed(true)}
              className="absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition"
              title="收起信息面板"
              aria-label="收起信息面板"
            >
              ⟩
            </button>
          </aside>
        )}

        {/* 右侧折叠后的展开按钮 */}
        {rightPanelCollapsed && (
          <button
            type="button"
            onClick={() => setRightPanelCollapsed(false)}
            className="w-8 shrink-0 border-l border-gray-200 bg-white hover:bg-gray-50 transition flex items-center justify-center text-gray-400 hover:text-gray-600"
            title="展开信息面板"
            aria-label="展开信息面板"
          >
            <span className="text-xs">⟨</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 顶部导航栏
// ----------------------------------------------------------------
interface EditorHeaderProps {
  title: string
  onBack: () => void
  userName?: string
  onApplyTemplate?: () => void
  templateId: string | null
  documentId: string
}

function EditorHeader({ title, onBack, userName, onApplyTemplate, templateId, documentId }: EditorHeaderProps) {
  return (
    <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-gray-600 transition text-sm flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回</span>
      </button>
      <div className="w-px h-4 bg-gray-200" />
      <h1 className="text-sm font-medium text-gray-800 flex-1 truncate">{title}</h1>
      
      {/* 模板操作组 */}
      {(onApplyTemplate || templateId) && (
        <>
          <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
            {onApplyTemplate && (
              <button
                onClick={onApplyTemplate}
                className="h-7 px-3 rounded border border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition shrink-0 flex items-center gap-1.5"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>应用模板</span>
              </button>
            )}
            {templateId && <SyncTemplateButton documentId={documentId} />}
            <ExportTemplateButton documentId={documentId} documentTitle={title} />
          </div>
        </>
      )}
      
      {/* 文档操作组 */}
      <div className="flex items-center gap-2">
        <ExportMenu documentId={documentId} documentTitle={title} />
      </div>
      
      {userName && (
        <span className="text-xs text-gray-400 shrink-0">{userName}</span>
      )}
    </header>
  )
}

// ----------------------------------------------------------------
// 同步模板到最新版本
// ----------------------------------------------------------------
function SyncTemplateButton({ documentId }: { documentId: string }) {
  const [syncing, setSyncing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await documentService.syncTemplate(documentId)
      toastSuccess("已同步到最新版本，请重新应用模板")
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "同步失败")
    } finally {
      setSyncing(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={syncing}
        className="h-7 px-3 rounded border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition shrink-0 flex items-center gap-1.5"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
        <span>{syncing ? "同步中..." : "同步模板"}</span>
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="同步到最新版本？"
        description="将用官方模板最新版本覆盖当前文档的模板配置，自定义修改会丢失。同步后需重新应用模板才能更新文档内容。"
        confirmLabel="同步"
        onConfirm={handleSync}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

// ----------------------------------------------------------------
// 导出模板到个人库
// ----------------------------------------------------------------
function ExportTemplateButton({ documentId, documentTitle }: { documentId: string; documentTitle: string }) {
  const [exporting, setExporting] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const handleConfirm = async (name: string) => {
    setShowInput(false)
    setExporting(true)
    try {
      const exported = await documentService.exportTemplate(documentId, {
        display_name: name.trim() || undefined,
      })
      toastSuccess(`已导出模板：${exported.display_name}`)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "导出模板失败")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowInput(true)}
        disabled={exporting}
        className="h-7 px-3 rounded border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 disabled:opacity-50 transition shrink-0 flex items-center gap-1.5"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>{exporting ? "导出中..." : "导出模板"}</span>
      </button>
      <InputDialog
        open={showInput}
        title="导出到个人模板库"
        description="可留空使用当前模板名"
        placeholder={`${documentTitle} 模板`}
        defaultValue={`${documentTitle} 模板`}
        confirmLabel="导出"
        onConfirm={handleConfirm}
        onCancel={() => setShowInput(false)}
      />
    </>
  )
}

// ----------------------------------------------------------------
// 导出下拉菜单
// ----------------------------------------------------------------
interface ExportMenuProps {
  documentId: string
  documentTitle: string
}

function ExportMenu({ documentId, documentTitle }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const formats: Array<{
    key: "docx" | "pdf" | "md"
    label: string
    mime: string
    ext: string
  }> = [
      { key: "docx", label: "Word (.docx)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
      { key: "pdf", label: "PDF (.pdf)", mime: "application/pdf", ext: "pdf" },
      { key: "md", label: "Markdown (.md)", mime: "text/markdown", ext: "md" },
    ]

  const handleExport = async (fmt: typeof formats[0]) => {
    setOpen(false)
    setExporting(fmt.key)
    try {
      const blob = await documentService.exportFile(documentId, fmt.key)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${documentTitle || documentId}.${fmt.ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "导出失败")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!exporting}
        className="h-7 px-3 rounded border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{exporting ? "导出中..." : "导出"}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-md py-1 min-w-36">
            {formats.map(fmt => (
              <button
                key={fmt.key}
                onClick={() => handleExport(fmt)}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition"
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
