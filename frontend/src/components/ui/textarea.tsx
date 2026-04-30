"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-y",
          error 
            ? "border-red-300 focus:ring-red-500" 
            : "border-gray-300 focus:border-blue-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
