"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { literatureService } from "@/services/literatureService"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import { toastError } from "@/hooks/useToast"
import UploadLiteratureDialog from "@/components/literature/UploadLiteratureDialog"
import EditLiteratureDialog from "@/components/literature/EditLiteratureDialog"
import type { Literature } from "@/types/api"

type ScopeFilter = "" | "public" | "private"
type StatusFilter = "" | "ready" | "pending" | "failed"
type ModeFilter = "" | "fast" | "full"

export default function LiteratureManagementContainer() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [items, setItems] = useState<Literature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 筛选条件
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")
  const [modeFilter, setModeFilter] = useState<ModeFilter>("")
  const [searchKeyword, setSearchKeyword] = useState("")

  // 对话框状态
  const [showUpload, setShowUpload] = useState(false)
  const [editingLit, setEditingLit] = useState<Literature | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await literatureService.list()
      setItems(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 前端筛选逻辑
  const filteredItems = items.filter((lit) => {
    // Scope 筛选
    if (scopeFilter && lit.scope !== scopeFilter) return false

    // 状态筛选
    if (statusFilter && lit.upload_status !== statusFilter) return false

    // 模式筛选
    if (modeFilter && lit.processing_mode !== modeFilter) return false

    // 搜索关键字
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase()
      const matchTitle = lit.title?.toLowerCase().includes(kw)
      const matchAuthors = lit.authors?.toLowerCase().includes(kw)
      const matchJournal = lit.journal?.toLowerCase().includes(kw)
      const matchDoi = lit.doi?.toLowerCase().includes(kw)
      if (!matchTitle && !matchAuthors && !matchJournal && !matchDoi) return false
    }

    return true
  })

  const handleDelete = async (id: string) => {
    try {
      await literatureService.delete(id)
      setItems((prev) => prev.filter((lit) => lit.literature_id !== id))
      setDeletingId(null)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
      setDeletingId(null)
    }
  }

  const handleRetry = async (id: string) => {
    setRetryingId(id)
    try {
      const updated = await literatureService.retry(id)
      setItems((prev) =>
        prev.map((lit) => (lit.literature_id === id ? updated : lit))
      )
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "重试失败")
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/documents")}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            ← 返回首页
          </button>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-lg font-semibold text-gray-800">文献管理</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name}</span>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">我的文献库</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              管理您的文献资源，支持上传、编辑和删除
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="h-9 px-5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition"
          >
            + 上传文献
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">{error}</div>
        )}

        {/* 筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-4">
          {/* 搜索框 */}
          <div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="🔍 搜索标题、作者、期刊、DOI..."
              className="w-full h-10 rounded-lg border border-gray-300 px-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          {/* 筛选按钮组 */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Scope 筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">范围:</span>
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                {(["", "public", "private"] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setScopeFilter(scope)}
                    className={cn(
                      "px-4 h-8 text-sm font-medium transition",
                      scopeFilter === scope
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {scope === "" ? "全部" : scope === "public" ? "🌐 公共" : "🔒 私有"}
                  </button>
                ))}
              </div>
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">状态:</span>
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                {(["", "ready", "pending", "failed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-4 h-8 text-sm font-medium transition",
                      statusFilter === status
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {status === ""
                      ? "全部"
                      : status === "ready"
                      ? "就绪"
                      : status === "pending"
                      ? "处理中"
                      : "失败"}
                  </button>
                ))}
              </div>
            </div>

            {/* 模式筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">模式:</span>
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                {(["", "fast", "full"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setModeFilter(mode)}
                    className={cn(
                      "px-4 h-8 text-sm font-medium transition",
                      modeFilter === mode
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {mode === "" ? "全部" : mode === "fast" ? "快速" : "完整"}
                  </button>
                ))}
              </div>
            </div>

            {/* 统计信息 */}
            <div className="ml-auto text-sm text-gray-500">
              共 <span className="font-semibold text-gray-700">{filteredItems.length}</span> 篇文献
            </div>
          </div>
        </div>

        {/* 文献列表 */}
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">加载中...</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-base">
              {items.length === 0 ? "还没有文献" : "没有符合条件的文献"}
            </p>
            <p className="text-sm mt-1">
              {items.length === 0
                ? '点击"上传文献"开始添加'
                : "尝试调整筛选条件"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((lit) => (
              <div
                key={lit.literature_id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition relative group"
              >
                {/* 操作按钮（hover 显示） */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition flex gap-1">
                  {deletingId === lit.literature_id ? (
                    <>
                      <button
                        onClick={() => handleDelete(lit.literature_id)}
                        className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingLit(lit)}
                        className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                        title="编辑"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setDeletingId(lit.literature_id)}
                        className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                        title="删除"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>

                {/* 标题 */}
                <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 pr-20">
                  {lit.title ?? <span className="text-gray-400 italic">标题解析中...</span>}
                </h3>

                {/* 作者 */}
                {lit.authors && (
                  <p className="text-xs text-gray-500 mb-1 truncate">{lit.authors}</p>
                )}

                {/* 期刊 */}
                {lit.journal && (
                  <p className="text-xs text-gray-500 mb-2 truncate">{lit.journal}</p>
                )}

                {/* 标签 */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {/* Scope 标签 */}
                  {lit.scope === "public" ? (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-600">
                      🌐 公共
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-600">
                      🔒 私有
                    </span>
                  )}

                  {/* 处理模式 */}
                  <span
                    className={
                      lit.processing_mode === "fast"
                        ? "rounded px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600"
                        : "rounded px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600"
                    }
                  >
                    {lit.processing_mode === "fast" ? "快速" : "完整"}
                  </span>

                  {/* 状态 */}
                  <span
                    className={
                      lit.upload_status === "ready"
                        ? "rounded px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600"
                        : lit.upload_status === "pending"
                        ? "rounded px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-600"
                        : "rounded px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600"
                    }
                  >
                    {lit.upload_status === "ready"
                      ? "就绪"
                      : lit.upload_status === "pending"
                      ? "处理中"
                      : "失败"}
                  </span>

                  {/* IF */}
                  {lit.impact_factor != null && (
                    <span className="rounded px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-600">
                      IF: {lit.impact_factor.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* 底部信息 */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{lit.chunk_count} 个分块</span>
                  {lit.upload_status === "failed" && (
                    <button
                      onClick={() => handleRetry(lit.literature_id)}
                      disabled={retryingId === lit.literature_id}
                      className="text-blue-500 hover:underline disabled:opacity-50"
                    >
                      {retryingId === lit.literature_id ? "重试中..." : "重试"}
                    </button>
                  )}
                </div>

                {/* 错误信息 */}
                {lit.upload_status === "failed" && lit.error_message && (
                  <div className="mt-2 p-2 rounded bg-red-50 text-xs text-red-600">
                    {lit.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 上传对话框 */}
      {showUpload && (
        <UploadLiteratureDialog
          onClose={() => setShowUpload(false)}
          onUploaded={(lit) => {
            setItems((prev) => [lit, ...prev])
            setShowUpload(false)
          }}
        />
      )}

      {/* 编辑对话框 */}
      {editingLit && (
        <EditLiteratureDialog
          literature={editingLit}
          onClose={() => setEditingLit(null)}
          onUpdated={(updated) => {
            setItems((prev) =>
              prev.map((lit) =>
                lit.literature_id === updated.literature_id ? updated : lit
              )
            )
            setEditingLit(null)
          }}
        />
      )}
    </div>
  )
}
