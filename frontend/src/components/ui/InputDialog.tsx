"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { useState, useEffect } from "react"

interface InputDialogProps {
  open: boolean
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function InputDialog({
  open,
  title,
  description,
  placeholder,
  defaultValue = "",
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)

  // 每次打开时重置为默认值
  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(value)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Title className="text-base font-semibold text-gray-800">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1 text-sm text-gray-500">
              {description}
            </Dialog.Description>
          )}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-md border border-gray-300 px-4 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                className="h-9 rounded-md bg-blue-500 px-4 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                {confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
