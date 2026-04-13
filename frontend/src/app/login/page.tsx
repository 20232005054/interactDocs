"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authService } from "@/services/authService"
import { useAuthStore } from "@/store/authStore"

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token = await authService.login({ email, password })
      // 先把 token 写入 localStorage，再调 getMe（getMe 需要 token）
      localStorage.setItem("token", token.access_token)
      const user = await authService.getMe()
      setAuth(token.access_token, user)
      router.push(user.role === "admin" ? "/admin" : "/documents")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-1">登录</h1>
        <p className="text-sm text-muted-foreground mb-6">欢迎回来，请输入账号信息</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/register" className="text-primary hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
