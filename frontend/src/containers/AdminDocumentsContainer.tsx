"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { adminService } from "@/services/adminService"
import { cn } from "@/lib/utils"
import type { DocumentListItem } from "@/types/api"

const PAGE_SIZE = 20

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "muted"
}

function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export default function AdminDocumentsContainer() {
  const [items, setItems] = useState<DocumentListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminService.listDocuments(page, PAGE_SIZE)
      setItems(response.items)
      setTotal(response.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const handleDelete = async (documentId: string) => {
    setError(null)
    try {
      await adminService.deleteDocument(documentId)
      const nextTotal = Math.max(0, total - 1)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
      if (page > nextTotalPages) {
        setPage(nextTotalPages)
      } else {
        await load()
      }
      setTotal(nextTotal)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          共 {total} 份文档
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">文档</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">用途</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">模板</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建时间</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">更新时间</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              )}
              {!loading && items.map((item) => (
                <tr key={item.document_id} className="border-t border-border transition hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      ID: {item.document_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.purpose ? (
                      <Badge>{item.purpose}</Badge>
                    ) : (
                      <span className="text-muted-foreground">未设置</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {item.template_purpose && <Badge>{item.template_purpose}</Badge>}
                      {item.template_name ? (
                        <Badge variant="muted">{item.template_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">未关联模板</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/documents/${item.document_id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        查看
                      </Link>
                      {deletingId === item.document_id ? (
                        <>
                          <button
                            onClick={() => void handleDelete(item.document_id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            确认删除
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs text-muted-foreground hover:underline"
                          >
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="h-8 rounded border border-border px-3 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="h-8 rounded border border-border px-3 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
