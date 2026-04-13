"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"

export default function RootPage() {
  const router = useRouter()
  const { token, user, initFromStorage } = useAuthStore()

  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])

  useEffect(() => {
    if (!token) {
      router.replace("/login")
    } else if (user?.role === "admin") {
      router.replace("/admin")
    } else {
      router.replace("/documents")
    }
  }, [token, user, router])

  return null
}
