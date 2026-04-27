"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { templateService } from "@/services/templateService"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { toastError } from "@/hooks/useToast"
import type { Template } from "@/types/api"
import { cn } from "@/lib/utils"

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "muted" }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
      variant === "success" && "bg-primary/10 text-primary",
      variant === "muted" && "bg-muted text-muted-foreground",
      variant === "default" && "bg-secondary text-secondary-foreground",
    )}>
      {children}
    </span>
  )
}

export default function TemplateListContainer() {
  const router = useRouter()

  const [items, setItems] = useState<Template[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [keyword, setKeyword] = useState("")
  const [isSystem, setIsSystem] = useState<boolean>(true)
  const [purpose, setPurpose] = useState<string>("")
  const [isActive, setIsActive] = useState<"true" | "false" | "">("")
  const [purposes, setPurposes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // 导入状态
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const debouncedKeyword = useDebounce(keyword)

  // 加载用途列表（跟随 isSystem 变化）
  useEffect(() => {
    templateService.getPurposes(isSystem ? 1 : 2).then(res => {
      setPurposes(res.purposes)
      setPurpose("")
    }).catch(() => setPurposes([]))
  }, [isSystem])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await templateService.list({
        keyword: debouncedKeyword || undefined,
        template_type: isSystem ? 1 : undefined,
        purpose: purpose || undefined,
        is_active: isActive === "" ? undefined : isActive === "true",
        page,
        page_size: pageSize,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [debouncedKeyword, isSystem, purpose, isActive, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedKeyword, isSystem, purpose, isActive])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (templateId: string) => {
    try {
      await templateService.delete(templateId)
      load()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setImporting(true)
    setImportError(null)
    try {
      await templateService.import(file, isSystem)
      load()
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col gap-4">
      {/* 操作栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索模板名称或用途..."
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        />

        {/* template_type 切换 */}
        <div className="flex items-center rounded-md border border-input overflow-hidden text-sm">
          <button
            onClick={() => setIsSystem(true)}
            className={cn(
              "px-3 h-9 transition",
              isSystem ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            系统模板
          </button>
          <button
            onClick={() => setIsSystem(false)}
            className={cn(
              "px-3 h-9 transition",
              !isSystem ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            用户模板
          </button>
        </div>

        {/* 用途筛选 */}
        <select
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        >
          <option value="">全部用途</option>
          {purposes.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* 启用状态筛选 */}
        <select
          value={isActive}
          onChange={e => setIsActive(e.target.value as "true" | "false" | "")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        >
          <option value="true">已启用</option>
          <option value="false">已停用</option>
          <option value="">全部状态</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* 隐藏的文件选择器 */}
          <input
            id="import-template-input"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <label
            htmlFor="import-template-input"
            className={cn(
              "h-9 px-4 rounded-md border border-input text-sm font-medium cursor-pointer transition flex items-center",
              importing
                ? "opacity-50 pointer-events-none bg-muted text-muted-foreground"
                : "bg-background text-foreground hover:bg-muted"
            )}
          >
            {importing ? "导入中..." : `导入${isSystem ? "系统" : ""}模板`}
          </label>
          <button
            onClick={() => router.push("/admin/templates/new")}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            + 新建模板
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {importError && <p className="text-sm text-destructive">导入失败：{importError}</p>}

      {/* 表格 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">模板名称</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">用途</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">版本</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">状态</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">更新时间</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
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
            {!loading && items.map((t) => (
              <tr key={t.template_id} className="border-t border-border hover:bg-muted/30 transition">
                <td className="px-4 py-3 font-medium text-foreground">{t.display_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.purpose}</td>
                <td className="px-4 py-3">
                  <Badge variant="muted">v{t.version}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {t.template_type === 1 && <Badge variant="success">系统</Badge>}
                    {t.template_type === 2 && <Badge variant="muted">可复用</Badge>}
                    {t.is_active
                      ? <Badge variant="success">启用</Badge>
                      : <Badge variant="muted">停用</Badge>
                    }
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(t.updated_at).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => router.push(`/admin/templates/${t.template_id}`)}
                      className="text-sm text-primary hover:underline"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await templateService.exportJson(t.template_id, t.display_name)
                        } catch (err: unknown) {
                          toastError(err instanceof Error ? err.message : "导出失败")
                        }
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      导出
                    </button>
                    {deletingId === t.template_id ? (
                      <div className="flex gap-1.5 text-sm">
                        <button
                          onClick={() => handleDelete(t.template_id)}
                          className="text-destructive hover:underline"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-muted-foreground hover:underline"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(t.template_id)}
                        className="text-sm text-muted-foreground hover:text-destructive transition"
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

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 px-3 rounded border border-border disabled:opacity-40 hover:bg-muted transition"
            >
              上一页
            </button>
            <span className="h-8 px-3 flex items-center">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 px-3 rounded border border-border disabled:opacity-40 hover:bg-muted transition"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="确认删除模板？"
        description="此操作不可撤销。"
        confirmLabel="删除"
        destructive
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
