"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"

interface AdminLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: "/admin", label: "总览", exact: true },
  { href: "/admin/users", label: "用户管理" },
  { href: "/admin/documents", label: "文档管理" },
  { href: "/admin/templates", label: "模板管理" },
  { href: "/admin/literature", label: "文献管理" },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearAuth } = useAuthStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // 直接从 localStorage 读取并初始化，避免依赖 initFromStorage 的调用时序
    const token = localStorage.getItem("token")
    const userStr = localStorage.getItem("user")
    if (token && userStr) {
      try {
        const parsed = JSON.parse(userStr)
        useAuthStore.setState({ token, user: parsed })
      } catch {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      }
    }
    const frameId = window.requestAnimationFrame(() => {
      setInitialized(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    if (!initialized) return
    const currentUser = useAuthStore.getState().user
    if (!currentUser) {
      router.replace("/login")
      return
    }
    if (currentUser.role !== "admin") {
      router.replace("/")
    }
  }, [initialized, router])

  const handleLogout = () => {
    clearAuth()
    router.push("/login")
  }

  // 未初始化完成前不渲染，避免闪烁
  if (!initialized || !user || user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="h-14 bg-card border-b border-border flex items-center px-6 gap-6">
        <span className="font-semibold text-foreground">InteractiveDocs 管理后台</span>
        <nav className="flex gap-4 ml-4">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm transition",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-destructive transition"
          >
            退出
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
