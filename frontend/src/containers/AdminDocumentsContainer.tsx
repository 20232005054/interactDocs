"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { adminService } from "@/services/adminService"
import type { DocumentListItem, User } from "@/types/api"

const PAGE_SIZE = 20

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
      {children}
    </span>
  )
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })
}

export default function AdminDocumentsContainer() {
  const [items, setItems] = useState<DocumentListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [keyword, setKeyword] = useState("")
  const [purposeFilter, setPurposeFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")
  const [purposeOptions, setPurposeOptions] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    adminService.listUsers(1, 200).then(res => setUsers(res.items)).catch(() => {})
  }, [])

  const load = useCallback(async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminService.listDocuments(p, PAGE_SIZE, {
        keyword: keyword.trim() || undefined,
        purpose: purposeFilter || undefined,
        user_id: userFilter || undefined,
      })
      setItems(response.items)
      setTotal(response.total)
      setPurposeOptions(prev => {
        const merged = new Set([...prev, ...response.items.map(i => i.purpose).filter(Boolean) as string[]])
        return Array.from(merged).sort()
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [page, keyword, purposeFilter, userFilter])

  useEffect(() => { void load() }, [load])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const handleSearch = () => { setPage(1); void load(1) }
  const handleClear = () => { setKeyword(""); setPurposeFilter(""); setUserFilter(""); setPage(1) }

  const handleDelete = async (documentId: string) => {
    setError(null)
    try {
      await adminService.deleteDocument(documentId)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const hasFilter = keyword || purposeFilter || userFilter

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="搜索文档标题..."
          className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        />
        <select
          value={purposeFilter}
          onChange={e => { setPurposeFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        >
          <option value="">全部用途</option>
          {purposeOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        >
          <option value="">全部用户</option>
          {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
        </select>
        <button
          onClick={handleSearch}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          搜索
        </button>
        {hasFilter && (
          <button
            onClick={handleClear}
            className="h-9 px-3 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted transition"
          >
            清除
          </button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">共 {total} 份文档</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">文档</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">模板</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建者</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">更新时间</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">加载中...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无数据</td></tr>
              )}
              {!loading && items.map((item) => (
                <tr key={item.document_id} className="border-t border-border transition hover:bg-muted/30">
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium text-foreground truncate" title={item.title}>{item.title}</div>
                    {item.purpose && <div className="mt-0.5"><Badge>{item.purpose}</Badge></div>}
                    <div className="mt-0.5 text-xs text-muted-foreground/60 truncate">{item.document_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    {item.template_name
                      ? <span className="text-sm text-foreground">{item.template_name}</span>
                      : <span className="text-xs text-muted-foreground">未关联</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.user_name ?? <span className="text-xs text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/documents/${item.document_id}`} className="text-xs text-primary hover:underline">
                        查看
                      </Link>
                      {deletingId === item.document_id ? (
                        <>
                          <button onClick={() => void handleDelete(item.document_id)} className="text-xs text-destructive hover:underline">
                            确认删除
                          </button>
                          <button onClick={() => setDeletingId(null)} className="text-xs text-muted-foreground hover:underline">
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeletingId(item.document_id)}
                          className="text-xs text-muted-foreground transition hover:text-destructive"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>第 {page} / {totalPages} 页</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="h-8 rounded border border-border px-3 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="h-8 rounded border border-border px-3 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}
