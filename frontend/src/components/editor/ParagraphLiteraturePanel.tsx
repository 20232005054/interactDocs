"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { literatureService } from "@/services/literatureService"
import { paragraphService } from "@/services/paragraphService"
import { toastError, toastSuccess } from "@/hooks/useToast"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import LiteratureBindDialog from "./LiteratureBindDialog"
import { cn } from "@/lib/utils"
import type { Literature, ParagraphLiteratureUploadPayload } from "@/types/api"

interface ParagraphLiteraturePanelProps {
  paragraphId: string
  visible: boolean
  onClose: () => void
}

export default function ParagraphLiteraturePanel({
  paragraphId,
  visible,
  onClose,
}: ParagraphLiteraturePanelProps) {
  const [items, setItems] = useState<Literature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showBind, setShowBind] = useState(false)
  const [unbindingId, setUnbindingId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await paragraphService.listLiterature(paragraphId)
      setItems(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [paragraphId])

  useEffect(() => {
    if (visible) {
      load()
    }
  }, [visible, load])

  // 有 pending/processing 时每 5s 轮询
  useEffect(() => {
    if (!visible) return
    const hasActive = items.some((i) => i.upload_status === "pending" || i.upload_status === "processing")
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await paragraphService.listLiterature(paragraphId)
          setItems(res.items)
        } catch {
          /* 静默 */
        }
      }, 5000)
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [visible, items, paragraphId])

  const handleUnbind = async (literatureId: string) => {
    try {
      await literatureService.unbindFromParagraph(paragraphId, literatureId)
      setItems((prev) => prev.filter((i) => i.literature_id !== literatureId))
      toastSuccess("解绑成功")
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "解绑失败")
    } finally {
      setUnbindingId(null)
    }
  }

  const handleRetry = async (literatureId: string) => {
    try {
      await literatureService.retry(literatureId)
      toastSuccess("已重新提交处理")
      // 立即刷新列表
      setTimeout(() => load(), 500)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "重试失败")
    }
  }

  const handleUploaded = (lit: Literature) => {
    setItems((prev) => [lit, ...prev])
    setShowUpload(false)
    toastSuccess("上传成功，后台处理中...")
  }

  const handleBound = (lit: Literature) => {
    setItems((prev) => [lit, ...prev])
    setShowBind(false)
    toastSuccess("绑定成功")
  }

  const unbindingLit = items.find((i) => i.literature_id === unbindingId)

  if (!visible) return null

  return (
    <>
      <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">段落文献</span>
            <span className="text-xs text-gray-400">({items.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowUpload(true)}
              className="h-6 px-2 rounded bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition"
            >
              上传
            </button>
            <button
              onClick={() => setShowBind(true)}
              className="h-6 px-2 rounded bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 transition"
            >
              绑定
            </button>
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 text-sm"
            >
              ×
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-3 py-6 text-center text-xs text-gray-400">加载中...</div>
          )}

          {error && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-red-500 mb-2">{error}</p>
              <button onClick={load} className="text-xs text-blue-500 hover:underline">
                重试
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              暂无绑定文献
              <p className="text-xs text-gray-300 mt-1">点击上传或绑定按钮添加文献</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="divide-y divide-gray-100">
              {items.map((lit) => (
                <LiteratureItem
                  key={lit.literature_id}
                  literature={lit}
                  onUnbind={() => setUnbindingId(lit.literature_id)}
                  onRetry={() => handleRetry(lit.literature_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 上传弹窗 */}
      {showUpload && (
        <UploadDialog
          paragraphId={paragraphId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {/* 绑定弹窗 */}
      {showBind && (
        <LiteratureBindDialog
          paragraphId={paragraphId}
          boundLiteratureIds={items.map((i) => i.literature_id)}
          onClose={() => setShowBind(false)}
          onBound={handleBound}
        />
      )}

      {/* 解绑确认 */}
      <ConfirmDialog
        open={!!unbindingId}
        title="确认解绑文献？"
        description={
          unbindingLit?.title
            ? `「${unbindingLit.title}」将从此段落解绑，不影响文献本身。`
            : "此操作不可撤销。"
        }
        confirmLabel="解绑"
        onConfirm={() => unbindingId && handleUnbind(unbindingId)}
        onCancel={() => setUnbindingId(null)}
      />
    </>
  )
}

// ----------------------------------------------------------------
// 文献条目
// ----------------------------------------------------------------
interface LiteratureItemProps {
  literature: Literature
  onUnbind: () => void
  onRetry: () => void
}

function LiteratureItem({ literature: lit, onUnbind, onRetry }: LiteratureItemProps) {
  const year = lit.publish_date ? new Date(lit.publish_date).getFullYear() : null
  const canRetry = lit.upload_status === "failed" || lit.upload_status === "pending"

  return (
    <div className="px-3 py-2 hover:bg-gray-50 transition group">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <p className="text-xs font-medium text-gray-800 leading-snug mb-1 truncate" title={lit.title ?? undefined}>
            {lit.title ?? <span className="text-gray-400 italic">标题未知</span>}
          </p>

          {/* 作者 */}
          {lit.authors && (
            <p className="text-xs text-gray-500 mb-0.5 truncate" title={lit.authors}>
              {formatAuthors(lit.authors)}
            </p>
          )}

          {/* 期刊 + 年份 */}
          {(lit.journal || year) && (
            <p className="text-xs text-gray-500 mb-1 truncate">
              {[lit.journal, year].filter(Boolean).join(", ")}
            </p>
          )}

          {/* 标签 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 状态 */}
            <StatusBadge status={lit.upload_status} errorMessage={lit.error_message} />

            {/* 处理模式 */}
            {lit.upload_status === "ready" && (
              <span
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                  lit.processing_mode === "fast" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                )}
              >
                {lit.processing_mode === "fast" ? "快速" : "完整"}
              </span>
            )}

            {/* 分块数 */}
            {lit.upload_status === "ready" && (
              <span className="text-[10px] text-gray-400">{lit.chunk_count} 块</span>
            )}

            {/* IF */}
            {lit.impact_factor != null && (
              <span
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                  lit.impact_factor >= 10
                    ? "bg-red-50 text-red-600"
                    : lit.impact_factor >= 5
                    ? "bg-orange-50 text-orange-600"
                    : "bg-blue-50 text-blue-600"
                )}
              >
                IF: {lit.impact_factor.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {canRetry && (
            <button
              onClick={onRetry}
              className="h-6 px-2 rounded text-xs text-blue-500 hover:bg-blue-50 transition"
              title="重试处理"
            >
              重试
            </button>
          )}
          <button
            onClick={onUnbind}
            className="h-6 px-2 rounded text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            title="解绑文献"
          >
            解绑
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 状态 badge
// ----------------------------------------------------------------
function StatusBadge({
  status,
  errorMessage,
}: {
  status: Literature["upload_status"]
  errorMessage: string | null
}) {
  const map = {
    pending: { label: "待处理", cls: "bg-gray-100 text-gray-500" },
    processing: { label: "处理中", cls: "bg-blue-100 text-blue-600" },
    ready: { label: "就绪", cls: "bg-green-100 text-green-700" },
    failed: { label: "失败", cls: "bg-red-100 text-red-600" },
  }
  const { label, cls } = map[status] ?? map.pending
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", cls)}>
      {status === "processing" && <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />}
      {label}
      {status === "failed" && errorMessage && (
        <span className="ml-0.5 text-red-400" title={errorMessage}>
          ⓘ
        </span>
      )}
    </span>
  )
}

// ----------------------------------------------------------------
// 上传弹窗
// ----------------------------------------------------------------
interface UploadDialogProps {
  paragraphId: string
  onClose: () => void
  onUploaded: (lit: Literature) => void
}

function UploadDialog({ paragraphId, onClose, onUploaded }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [journal, setJournal] = useState("")
  const [doi, setDoi] = useState("")
  const [impactFactor, setImpactFactor] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("请选择 PDF 文件")
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("文件大小不能超过 30MB")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload: ParagraphLiteratureUploadPayload = {
        file,
        title: title.trim() || undefined,
        authors: authors.trim() || undefined,
        journal: journal.trim() || undefined,
        doi: doi.trim() || undefined,
        impact_factor: impactFactor ? Number(impactFactor) : undefined,
      }
      const lit = await literatureService.uploadToParagraph(paragraphId, payload)
      onUploaded(lit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "h-8 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">上传文献到段落</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-3">
          {/* 提示 */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-xs text-blue-700 leading-relaxed">
              段落文献将使用<strong>快速模式</strong>处理（3-5秒），仅提取摘要用于 AI 帮填。
            </p>
          </div>

          {/* 文件选择 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600">
              PDF 文件 <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-gray-600 file:mr-2 file:h-7 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:text-xs file:font-medium file:text-blue-600 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-400">仅支持 PDF，最大 30MB。元数据可选填，未填写的字段将自动解析。</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-xs text-gray-600">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="自动解析"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-600">作者</label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="逗号分隔"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-600">期刊</label>
              <input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="自动解析"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-600">DOI</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="自动提取"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-600">影响因子</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={impactFactor}
                onChange={(e) => setImpactFactor(e.target.value)}
                placeholder="可选"
                className={inputCls}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-8 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {loading ? "上传中..." : "上传"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-8 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** 只显示第一作者，多人时加 et al. */
function formatAuthors(authors: string): string {
  const parts = authors.split(",").map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return authors
  return `${parts[0]} et al.`
}
