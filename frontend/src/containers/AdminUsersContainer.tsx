"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminService } from "@/services/adminService"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { User, UserRole } from "@/types/api"

const PAGE_SIZE = 20

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: "管理员", value: "admin" },
  { label: "编辑", value: "editor" },
  { label: "普通用户", value: "user" },
]

interface RoleBadgeProps {
  role: UserRole
}

function RoleBadge({ role }: RoleBadgeProps) {
  const labelMap: Record<UserRole, string> = {
    admin: "管理员",
    editor: "编辑",
    user: "普通用户",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
        role === "admin" && "bg-primary/10 text-primary",
        role === "editor" && "bg-amber-500/10 text-amber-700",
        role === "user" && "bg-muted text-muted-foreground"
      )}
    >
      {labelMap[role]}
    </span>
  )
}

export default function AdminUsersContainer() {
  const currentUser = useAuthStore((state) => state.user)

  const [items, setItems] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminService.listUsers(page, PAGE_SIZE)
      setItems(response.items)
      setTotal(response.total)
      setRoleDrafts((prev) => {
        const next: Record<string, UserRole> = {}
        for (const item of response.items) {
          if (prev[item.user_id] && prev[item.user_id] !== item.role) {
            next[item.user_id] = prev[item.user_id]
          }
        }
        return next
      })
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

  const handleRoleDraftChange = (userId: string, nextRole: UserRole) => {
    const currentRole = items.find((item) => item.user_id === userId)?.role
    if (!currentRole) return

    setRoleDrafts((prev) => {
      const next = { ...prev }
      if (nextRole === currentRole) {
        delete next[userId]
      } else {
        next[userId] = nextRole
      }
      return next
    })
  }

  const syncCurrentUser = (updatedUser: User) => {
    const authState = useAuthStore.getState()
    if (authState.user?.user_id !== updatedUser.user_id) return
    localStorage.setItem("user", JSON.stringify(updatedUser))
    useAuthStore.setState({ user: updatedUser })
  }

  const handleRoleSave = async (userId: string) => {
    const nextRole = roleDrafts[userId]
    if (!nextRole) return

    setSavingId(userId)
    setError(null)
    try {
      const updatedUser = await adminService.updateUserRole(userId, nextRole)
      setItems((prev) => prev.map((item) => (
        item.user_id === userId ? updatedUser : item
      )))
      setRoleDrafts((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      syncCurrentUser(updatedUser)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "角色更新失败")
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (userId: string) => {
    setError(null)
    try {
      await adminService.deleteUser(userId)
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
          共 {total} 名用户
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">姓名</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">邮箱</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">当前角色</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">调整角色</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              )}
              {!loading && items.map((item) => {
                const isCurrentUser = currentUser?.user_id === item.user_id
                const draftRole = roleDrafts[item.user_id] ?? item.role
                const hasPendingRoleChange = draftRole !== item.role

                return (
                  <tr key={item.user_id} className="border-t border-border align-top transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.name}</div>
                      {isCurrentUser && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          当前登录账号
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={item.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-col gap-2">
                        <select
                          value={draftRole}
                          disabled={isCurrentUser || savingId === item.user_id}
                          onChange={(event) => {
                            handleRoleDraftChange(item.user_id, event.target.value as UserRole)
                          }}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">
                          {hasPendingRoleChange ? "角色已修改，待保存" : "当前角色已生效"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {hasPendingRoleChange && !isCurrentUser && (
                          <>
                            <button
                              onClick={() => void handleRoleSave(item.user_id)}
                              disabled={savingId === item.user_id}
                              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingId === item.user_id ? "保存中..." : "保存"}
                            </button>
                            <button
                              onClick={() => handleRoleDraftChange(item.user_id, item.role)}
                              disabled={savingId === item.user_id}
                              className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              取消
                            </button>
                          </>
                        )}
                        {!hasPendingRoleChange && isCurrentUser && (
                          <span className="text-xs text-muted-foreground">不可操作</span>
                        )}
                        {!hasPendingRoleChange && !isCurrentUser && (
                          deletingId === item.user_id ? (
                            <>
                              <button
                                onClick={() => void handleDelete(item.user_id)}
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
                              onClick={() => setDeletingId(item.user_id)}
                              className="text-xs text-muted-foreground transition hover:text-destructive"
                            >
                              删除用户
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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
