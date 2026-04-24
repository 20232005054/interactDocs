"use client"

import { create } from "zustand"

export type ToastVariant = "default" | "success" | "error"

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  open: boolean
}

interface ToastStore {
  toasts: ToastItem[]
  toast: (options: Omit<ToastItem, "id" | "open">) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  toast: (options) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({
      toasts: [...state.toasts, { ...options, id, open: true }],
    }))
  },

  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// 便捷调用函数，无需在组件里 useToastStore
export function toast(options: Omit<ToastItem, "id" | "open">): void {
  useToastStore.getState().toast(options)
}

export function toastError(message: string): void {
  toast({ title: message, variant: "error" })
}

export function toastSuccess(message: string): void {
  toast({ title: message, variant: "success" })
}
