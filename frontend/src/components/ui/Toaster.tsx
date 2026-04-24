"use client"

import * as Toast from "@radix-ui/react-toast"
import { useToastStore } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

export default function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open={t.open}
          onOpenChange={(open) => { if (!open) dismiss(t.id) }}
          duration={t.duration ?? 3000}
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
            "bg-white",
            t.variant === "error" && "border-red-200 bg-red-50",
            t.variant === "success" && "border-green-200 bg-green-50",
            (!t.variant || t.variant === "default") && "border-gray-200"
          )}
        >
          <div className="flex-1 min-w-0">
            <Toast.Title className={cn(
              "text-sm font-medium",
              t.variant === "error" && "text-red-700",
              t.variant === "success" && "text-green-700",
              (!t.variant || t.variant === "default") && "text-gray-800"
            )}>
              {t.title}
            </Toast.Title>
            {t.description && (
              <Toast.Description className="mt-0.5 text-xs text-gray-500">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close className="shrink-0 text-gray-400 hover:text-gray-600 transition text-sm leading-none mt-0.5">
            ×
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" />
    </Toast.Provider>
  )
}
