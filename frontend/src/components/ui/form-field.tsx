"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"

export interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  description?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  required,
  error,
  description,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label required={required}>
          {label}
        </Label>
      )}
      {children}
      {description && !error && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
