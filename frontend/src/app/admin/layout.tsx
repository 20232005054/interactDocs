"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/store/authStore"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
    setInitialized(true)
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
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition">
            总览
          </Link>
          <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground transition">
            用户管理
          </Link>
          <Link href="/admin/documents" className="text-sm text-muted-foreground hover:text-foreground transition">
            文档管理
          </Link>
          <Link href="/admin/templates" className="text-sm text-muted-foreground hover:text-foreground transition">
            模板管理
          </Link>
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
