"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { chapterService } from "@/services/chapterService"
import { summaryService } from "@/services/summaryService"
import { coreInfoService } from "@/services/coreInfoService"
import { documentService } from "@/services/documentService"
import { useDocumentStore } from "@/store/documentStore"
import { useEditorStore, type RightPanelTab } from "@/store/editorStore"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import ChapterTree from "@/components/editor/ChapterTree"
import DocumentBody from "@/components/editor/DocumentBody"
import CoreInfoPanel from "@/components/editor/CoreInfoPanel"
import SummaryPanel from "@/components/editor/SummaryPanel"
import AIChatPanel from "@/components/editor/AIChatPanel"
import { useDocumentSSE } from "@/hooks/useDocumentSSE"

interface DocumentEditorContainerProps {
  documentId: string
}

export default function DocumentEditorContainer({ documentId }: DocumentEditorContainerProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { setFullContent, setSummaries, setCoreInfoTree, reset, documentTitle } = useDocumentStore()
  const { rightPanelTab, setRightPanelTab } = useEditorStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

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

  useEffect(() => {
    load()
    return () => reset()
  }, [load, reset])

  const tabs: { key: RightPanelTab; label: string }[] = [
    { key: "core-info", label: "核心信息" },
    { key: "summary", label: "摘要" },
    { key: "chat", label: "AI 对话" },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <EditorHeader title="加载中..." onBack={() => router.push("/documents")} userName={user?.name} documentId={documentId} />
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
        <EditorHeader title="加载失败" onBack={() => router.push("/documents")} userName={user?.name} documentId={documentId} />
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
        documentId={documentId}
      />

      {/* 三栏主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：章节树 */}
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <ChapterTree documentId={documentId} onReload={load} />
        </aside>

        {/* 中间：全文编辑区 */}
        <main className="flex-1 overflow-y-auto bg-white">
          <DocumentBody onReload={load} />
        </main>

        {/* 右侧：信息面板 */}
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-y-auto">
            {rightPanelTab === "core-info" && <CoreInfoPanel />}
            {rightPanelTab === "summary" && <SummaryPanel />}
            {rightPanelTab === "chat" && <AIChatPanel documentId={documentId} />}
          </div>
        </aside>
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
  documentId: string
}

function EditorHeader({ title, onBack, userName, onApplyTemplate, documentId }: EditorHeaderProps) {
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
      <ExportMenu documentId={documentId} documentTitle={title} />
      {userName && (
        <span className="text-xs text-gray-400 shrink-0">{userName}</span>
      )}
    </header>
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

  const formats = [
    { key: "docx", label: "Word (.docx)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
    { key: "pdf",  label: "PDF (.pdf)",   mime: "application/pdf", ext: "pdf" },
    { key: "md",   label: "Markdown (.md)", mime: "text/markdown", ext: "md" },
  ]

  const handleExport = async (fmt: typeof formats[0]) => {
    setOpen(false)
    setExporting(fmt.key)
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/export/${fmt.key}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error("导出失败")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${documentTitle || documentId}.${fmt.ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "导出失败")
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
