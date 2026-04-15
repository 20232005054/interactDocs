"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { documentService } from "@/services/documentService"
import { templateService } from "@/services/templateService"
import { useAuthStore } from "@/store/authStore"
import type { DocumentListItem, Template } from "@/types/api"

// ----------------------------------------------------------------
// 新建文档弹窗
// ----------------------------------------------------------------
interface CreateDocumentModalProps {
  onClose: () => void
  onCreated: (doc: DocumentListItem) => void
}

function CreateDocumentModal({ onClose, onCreated }: CreateDocumentModalProps) {
  const [title, setTitle] = useState("")
  const [purpose, setPurpose] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [purposes, setPurposes] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [purposeRes, templateRes] = await Promise.all([
          templateService.getPurposes(1),
          templateService.list({ include_user: true, is_active: true, page_size: 100 }),
        ])
        setPurposes(purposeRes.purposes)
        setTemplates(templateRes.items)
        setFilteredTemplates(templateRes.items)
      } finally {
        setLoadingTemplates(false)
      }
    }
    load()
  }, [])

  // 选择用途时过滤模板列表
  const handlePurposeChange = (val: string) => {
    setPurpose(val)
    setTemplateId("")
    setFilteredTemplates(val ? templates.filter(t => t.purpose === val) : templates)
  }

  // 选择模板时自动填充用途
  const handleTemplateChange = (val: string) => {
    setTemplateId(val)
    if (val) {
      const tpl = templates.find(t => t.template_id === val)
      if (tpl && !purpose) setPurpose(tpl.purpose)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !templateId) {
      setError("请填写文档标题并选择模板")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const tpl = templates.find(t => t.template_id === templateId)
      const doc = await documentService.create({
        title: title.trim(),
        purpose: tpl?.purpose ?? purpose,
        template_id: templateId,
      })
      onCreated(doc)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full h-9 rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition bg-white"
  const selectCls = "w-full h-9 rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">新建文档</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600">文档标题 <span className="text-red-500">*</span></label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="请输入文档标题"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600">用途 <span className="text-red-500">*</span></label>
            {loadingTemplates ? (
              <div className="h-9 bg-gray-100 rounded animate-pulse" />
            ) : (
              <select
                value={purpose}
                onChange={e => handlePurposeChange(e.target.value)}
                className={selectCls}
              >
                <option value="">全部用途</option>
                {purposes.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600">选择模板 <span className="text-red-500">*</span></label>
            {loadingTemplates ? (
              <div className="h-9 bg-gray-100 rounded animate-pulse" />
            ) : (
              <select
                value={templateId}
                onChange={e => handleTemplateChange(e.target.value)}
                className={selectCls}
              >
                <option value="">请选择模板</option>
                {filteredTemplates.filter(t => t.template_type === 1).length > 0 && (
                  <optgroup label="系统模板">
                    {filteredTemplates.filter(t => t.template_type === 1).map(t => (
                      <option key={t.template_id} value={t.template_id}>{t.display_name}</option>
                    ))}
                  </optgroup>
                )}
                {filteredTemplates.filter(t => t.template_type === 2).length > 0 && (
                  <optgroup label="我的模板">
                    {filteredTemplates.filter(t => t.template_type === 2).map(t => (
                      <option key={t.template_id} value={t.template_id}>{t.display_name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {loading ? "创建中..." : "创建"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
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
export default function DocumentListContainer() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  const [items, setItems] = useState<DocumentListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 12

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await documentService.list({ page, page_size: pageSize })
      setItems(res.items)
      setTotal(res.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    try {
      await documentService.delete(id)
      setItems(prev => prev.filter(d => d.document_id !== id))
      setTotal(prev => prev - 1)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-800">InteractiveDocs</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              管理后台
            </button>
          )}
          <button
            onClick={() => router.push("/my-templates")}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            我的模板
          </button>
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button
            onClick={() => { clearAuth(); router.push("/login") }}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            退出
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">我的文档</h1>
            <p className="text-sm text-gray-500 mt-0.5">共 {total} 份文档</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition"
          >
            + 新建文档
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">{error}</div>
        )}

        {/* 文档卡片网格 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-base">还没有文档</p>
            <p className="text-sm mt-1">点击"新建文档"开始创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(doc => (
              <div
                key={doc.document_id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group relative"
                onClick={() => router.push(`/documents/${doc.document_id}`)}
              >
                {/* 标题 */}
                <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 pr-6">{doc.title}</h3>

                {/* 模板信息 */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {doc.template_purpose && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {doc.template_purpose}
                    </span>
                  )}
                  {doc.template_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {doc.template_name}
                    </span>
                  )}
                </div>

                {/* 更新时间 */}
                <p className="mt-3 text-xs text-gray-400">更新于 {formatDate(doc.updated_at)}</p>

                {/* 操作按钮（hover 显示） */}
                <div
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition"
                  onClick={e => e.stopPropagation()}
                >
                  {deletingId === doc.document_id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(doc.document_id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(doc.document_id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition"
                      title="删除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="h-8 px-3 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              上一页
            </button>
            <span className="text-gray-500">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="h-8 px-3 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              下一页
            </button>
          </div>
        )}
      </main>

      {/* 新建弹窗 */}
      {showCreate && (
        <CreateDocumentModal
          onClose={() => setShowCreate(false)}
          onCreated={doc => {
            setShowCreate(false)
            router.push(`/documents/${doc.document_id}`)
          }}
        />
      )}
    </div>
  )
}
