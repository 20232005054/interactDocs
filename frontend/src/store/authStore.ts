"use client"

import { create } from "zustand"
import type { User } from "@/types/api"

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,

  setAuth: (token, user) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    set({ token, user })
  },

  clearAuth: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    set({ token: null, user: null })
  },

  initFromStorage: () => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("token")
    const userStr = localStorage.getItem("user")
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        set({ token, user })
      } catch {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      }
    }
  },
}))
