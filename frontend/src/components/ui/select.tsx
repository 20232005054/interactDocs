"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error 
              ? "border-red-300 focus:ring-red-500" 
              : "border-gray-300 focus:border-blue-500",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
