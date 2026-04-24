"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { templateService } from "@/services/templateService"
import type { Template } from "@/types/api"
import { cn } from "@/lib/utils"
import { toastError } from "@/hooks/useToast"

// ----------------------------------------------------------------
// 重命名弹窗
// ----------------------------------------------------------------
interface RenameModalProps {
  template: Template
  onClose: () => void
  onRenamed: () => void
}

function RenameModal({ template, onClose, onRenamed }: RenameModalProps) {
  const [name, setName] = useState(template.display_name)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError("名称不能为空"); return }
    setLoading(true)
    setError(null)
    try {
      await templateService.update(template.template_id, { display_name: name.trim() })
      onRenamed()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重命名失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">重命名模板</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-9 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {loading ? "保存中..." : "保存"}
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
export default function MyTemplatesContainer() {
  const router = useRouter()

  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingTemplate, setRenamingTemplate] = useState<Template | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await templateService.list({ template_type: 2, is_active: true, page_size: 100 })
      setItems(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (templateId: string) => {
    try {
      await templateService.delete(templateId)
      setItems(prev => prev.filter(t => t.template_id !== templateId))
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/documents")}
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          ← 返回文档列表
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-800">我的模板库</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">我的模板</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              从文档导出的可复用模板，共 {items.length} 个
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-base">还没有导出的模板</p>
            <p className="text-sm mt-1">在文档编辑页点击"导出模板"即可保存到这里</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(t => (
              <div
                key={t.template_id}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-sm transition"
              >
                {/* 图标 */}
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 text-lg shrink-0">
                  📄
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.display_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    用途：{t.purpose} · 更新于 {formatDate(t.updated_at)}
                  </p>
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setRenamingTemplate(t)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded hover:bg-gray-100"
                  >
                    重命名
                  </button>
                  {deletingId === t.template_id ? (
                    <div className="flex gap-1.5 text-xs">
                      <button
                        onClick={() => handleDelete(t.template_id)}
                        className="text-red-500 hover:underline"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-gray-400 hover:underline"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(t.template_id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-gray-100"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 重命名弹窗 */}
      {renamingTemplate && (
        <RenameModal
          template={renamingTemplate}
          onClose={() => setRenamingTemplate(null)}
          onRenamed={() => { setRenamingTemplate(null); load() }}
        />
      )}
    </div>
  )
}
