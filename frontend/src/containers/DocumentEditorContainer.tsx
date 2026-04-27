"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  const [infoPanelCollapsed, setInfoPanelCollapsed] = useState(false)

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

  useEffect(() => {
    resetChat()
    load()
    return () => {
      reset()
      resetChat()
    }
  }, [load, reset, resetChat])

  const tabs: { key: RightPanelTab; label: string }[] = [
    { key: "core-info", label: "核心信息" },
    { key: "summary", label: "摘要" },
    { key: "chat", label: "AI 对话" },
    { key: "citations", label: "参考文献" },
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

      {/* 三栏主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：章节树 */}
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <ChapterTree documentId={documentId} onReload={load} />
        </aside>

        {/* 中间：信息面板（核心信息 / 摘要 / AI 对话） */}
        {!infoPanelCollapsed && (
          <aside className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
            {/* Tab 切换 */}
            <div className="flex border-b border-gray-200 shrink-0">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setRightPanelTab(tab.key)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium transition border-b-2",
                    rightPanelTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div
              className={cn(
                "flex-1 min-h-0",
                rightPanelTab === "chat" ? "overflow-hidden" : "compact-scrollbar overflow-y-auto"
              )}
            >
              <div className={cn(rightPanelTab === "core-info" ? "block" : "hidden")}>
                <CoreInfoPanel onAfterSave={refreshEditorContent} />
              </div>
              <div className={cn(rightPanelTab === "summary" ? "block" : "hidden")}>
                <SummaryPanel onAfterSave={refreshEditorContent} />
              </div>
              <div className={cn("h-full min-h-0", rightPanelTab === "chat" ? "block" : "hidden")}>
                <AIChatPanel documentId={documentId} />
              </div>
              <div className={cn(rightPanelTab === "citations" ? "block" : "hidden")}>
                <CitationsPanel documentId={documentId} />
              </div>
            </div>
          </aside>
        )}

        {/* 右侧：全文编辑区 */}
        <main className="relative flex-1 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setInfoPanelCollapsed((prev) => !prev)}
            className="absolute left-2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition"
            title={infoPanelCollapsed ? "展开信息面板" : "收起信息面板"}
            aria-label={infoPanelCollapsed ? "展开信息面板" : "收起信息面板"}
          >
            {infoPanelCollapsed ? "⟩" : "⟨"}
          </button>
          <div className="h-full overflow-y-auto">
            <DocumentBody onReload={load} />
          </div>
        </main>
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
        ← 返回
      </button>
      <div className="w-px h-4 bg-gray-200" />
      <h1 className="text-sm font-medium text-gray-800 flex-1 truncate">{title}</h1>
      {onApplyTemplate && (
        <button
          onClick={onApplyTemplate}
          className="h-7 px-3 rounded border border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition shrink-0"
        >
          应用模板
        </button>
      )}
      {templateId && <SyncTemplateButton documentId={documentId} />}
      <ExportTemplateButton documentId={documentId} documentTitle={title} />
      <ExportMenu documentId={documentId} documentTitle={title} />
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
        className="h-7 px-3 rounded border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition shrink-0"
      >
        {syncing ? "同步中..." : "同步模板"}
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
        className="h-7 px-3 rounded border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 disabled:opacity-50 transition shrink-0"
      >
        {exporting ? "导出中..." : "导出模板"}
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
        className="h-7 px-3 rounded border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition flex items-center gap-1"
      >
        {exporting ? "导出中..." : "导出"}
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
