"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { literatureService } from "@/services/literatureService"
import { useAuthStore } from "@/store/authStore"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { toastError, toastSuccess } from "@/hooks/useToast"
import { cn } from "@/lib/utils"
import type { Literature, UpdateLiteraturePayload } from "@/types/api"

// ----------------------------------------------------------------
// 状态 badge
// ----------------------------------------------------------------
function StatusBadge({ status, errorMessage }: { status: Literature["upload_status"]; errorMessage: string | null }) {
  const map = {
    pending:    { label: "待处理", cls: "bg-gray-100 text-gray-500" },
    processing: { label: "处理中", cls: "bg-blue-100 text-blue-600" },
    ready:      { label: "就绪",   cls: "bg-green-100 text-green-700" },
    failed:     { label: "失败",   cls: "bg-red-100 text-red-600" },
  }
  const { label, cls } = map[status] ?? map.pending
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", cls)}>
      {status === "processing" && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {label}
      {status === "failed" && errorMessage && (
        <span className="ml-1 text-red-400" title={errorMessage}>ⓘ</span>
      )}
    </span>
  )
}

// ----------------------------------------------------------------
// 上传弹窗
// ----------------------------------------------------------------
interface UploadDialogProps {
  onClose: () => void
  onUploaded: (lit: Literature) => void
}

function UploadDialog({ onClose, onUploaded }: UploadDialogProps) {
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
    if (!file) { setError("请选择 PDF 文件"); return }
    setLoading(true)
    setError(null)
    try {
      const lit = await literatureService.upload({
        file,
        title: title.trim() || undefined,
        authors: authors.trim() || undefined,
        journal: journal.trim() || undefined,
        doi: doi.trim() || undefined,
        impact_factor: impactFactor ? Number(impactFactor) : undefined,
      })
      onUploaded(lit)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "h-9 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">上传文献</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* 文件选择 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600">PDF 文件 <span className="text-red-500">*</span></label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 file:mr-3 file:h-8 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:text-xs file:font-medium file:text-blue-600 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-400">仅支持 PDF，最大 30MB。元数据可选填，未填写的字段将由系统自动解析。</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">标题</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="自动解析" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">作者</label>
              <input type="text" value={authors} onChange={e => setAuthors(e.target.value)} placeholder="逗号分隔" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">期刊</label>
              <input type="text" value={journal} onChange={e => setJournal(e.target.value)} placeholder="自动解析" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">DOI</label>
              <input type="text" value={doi} onChange={e => setDoi(e.target.value)} placeholder="自动提取" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">影响因子</label>
              <input type="number" step="0.01" min="0" value={impactFactor} onChange={e => setImpactFactor(e.target.value)} placeholder="可选" className={inputCls} />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="flex-1 h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition">
              {loading ? "上传中..." : "上传"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 编辑元数据弹窗
// ----------------------------------------------------------------
interface EditDialogProps {
  lit: Literature
  onClose: () => void
  onSaved: (lit: Literature) => void
}

function EditDialog({ lit, onClose, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(lit.title ?? "")
  const [authors, setAuthors] = useState(lit.authors ?? "")
  const [journal, setJournal] = useState(lit.journal ?? "")
  const [doi, setDoi] = useState(lit.doi ?? "")
  const [impactFactor, setImpactFactor] = useState(lit.impact_factor != null ? String(lit.impact_factor) : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const payload: UpdateLiteraturePayload = {}
    if (title.trim()) payload.title = title.trim()
    if (authors.trim()) payload.authors = authors.trim()
    if (journal.trim()) payload.journal = journal.trim()
    if (doi.trim()) payload.doi = doi.trim()
    if (impactFactor) payload.impact_factor = Number(impactFactor)
    try {
      const updated = await literatureService.update(lit.literature_id, payload)
      onSaved(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "h-9 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">编辑文献元数据</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">标题</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">作者</label>
              <input type="text" value={authors} onChange={e => setAuthors(e.target.value)} placeholder="逗号分隔" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">期刊</label>
              <input type="text" value={journal} onChange={e => setJournal(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">DOI</label>
              <input type="text" value={doi} onChange={e => setDoi(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600">影响因子</label>
              <input type="number" step="0.01" min="0" value={impactFactor} onChange={e => setImpactFactor(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="flex-1 h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition">
              {loading ? "保存中..." : "保存"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 主容器
// ----------------------------------------------------------------
export default function LiteratureContainer() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<Literature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [scopeFilter, setScopeFilter] = useState<"" | "public" | "private">("")
  const [showUpload, setShowUpload] = useState(false)
  const [editingLit, setEditingLit] = useState<Literature | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await literatureService.list(scopeFilter || undefined)
      setItems(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [scopeFilter])

  useEffect(() => { load() }, [load])

  // 有 pending/processing 时每 5s 轮询
  useEffect(() => {
    const hasActive = items.some(i => i.upload_status === "pending" || i.upload_status === "processing")
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await literatureService.list()
          setItems(res.items)
        } catch { /* 静默 */ }
      }, 5000)
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
  }, [items])

  const handleRetry = async (id: string) => {
    try {
      const updated = await literatureService.retry(id)
      setItems(prev => prev.map(i => i.literature_id === id ? updated : i))
      toastSuccess("已重新提交处理")
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "重试失败")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await literatureService.delete(id)
      setItems(prev => prev.filter(i => i.literature_id !== id))
      toastSuccess("删除成功")
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })

  const filtered = items.filter(i => {
    if (!keyword.trim()) return true
    const kw = keyword.toLowerCase()
    return (
      i.title?.toLowerCase().includes(kw) ||
      i.authors?.toLowerCase().includes(kw) ||
      i.doi?.toLowerCase().includes(kw) ||
      i.journal?.toLowerCase().includes(kw)
    )
  })

  const deletingLit = items.find(i => i.literature_id === deletingId)

  return (
    <div className="flex flex-col gap-4">
      {/* 操作栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜索标题、作者、DOI、期刊..."
          className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        />
        {/* scope 筛选 */}
        <div className="flex items-center rounded-md border border-input overflow-hidden text-sm">
          {(["", "public", "private"] as const).map(s => (
            <button
              key={s}
              onClick={() => setScopeFilter(s)}
              className={cn(
                "px-3 h-9 transition",
                scopeFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {s === "" ? "全部" : s === "public" ? "公共" : "私有"}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 篇</span>
        <div className="ml-auto">
          <button
            onClick={() => setShowUpload(true)}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            + 上传文献
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 表格 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">标题</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">作者</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">期刊</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">DOI</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">状态</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">上传者</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">上传时间</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">加载中...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">暂无文献</td></tr>
            )}
            {!loading && filtered.map(lit => (
              <tr key={lit.literature_id} className="border-t border-border hover:bg-muted/30 transition">
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-foreground truncate" title={lit.title ?? undefined}>
                    {lit.title ?? <span className="text-muted-foreground italic">解析中...</span>}
                  </p>
                  {lit.impact_factor != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">IF: {lit.impact_factor}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                  <p className="truncate text-xs" title={lit.authors ?? undefined}>{lit.authors ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[140px]">
                  <p className="truncate text-xs" title={lit.journal ?? undefined}>{lit.journal ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {lit.doi ? (
                    <a
                      href={`https://doi.org/${lit.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {lit.doi}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lit.upload_status} errorMessage={lit.error_message} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {lit.scope === "private"
                    ? (lit.user_name ?? lit.user_id?.slice(0, 8) ?? "—")
                    : <span className="text-muted-foreground/50">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(lit.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingLit(lit)}
                      className="text-sm text-primary hover:underline"
                    >
                      编辑
                    </button>
                    {(lit.upload_status === "failed" || lit.upload_status === "pending") && (
                      <button
                        onClick={() => handleRetry(lit.literature_id)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        重试
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingId(lit.literature_id)}
                      className="text-sm text-muted-foreground hover:text-destructive transition"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 上传弹窗 */}
      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={lit => {
            setItems(prev => [lit, ...prev])
            setShowUpload(false)
            toastSuccess("上传成功，后台处理中...")
          }}
        />
      )}

      {/* 编辑弹窗 */}
      {editingLit && (
        <EditDialog
          lit={editingLit}
          onClose={() => setEditingLit(null)}
          onSaved={updated => {
            setItems(prev => prev.map(i => i.literature_id === updated.literature_id ? updated : i))
            setEditingLit(null)
            toastSuccess("保存成功")
          }}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deletingId}
        title="确认删除文献？"
        description={deletingLit?.title ? `「${deletingLit.title}」将被永久删除，关联的向量数据也会一并清除。` : "此操作不可撤销。"}
        confirmLabel="删除"
        destructive
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
