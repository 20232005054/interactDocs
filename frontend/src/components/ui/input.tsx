"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input"

export { Input }
