"use client"

import { cn } from "@/lib/utils"

interface DependencyRefItem {
  field_key: string
  label?: string
  type?: string
}

interface DependencyHoverCardProps {
  title: string
  items?: DependencyRefItem[]
  emptyText?: string
  tone?: "blue" | "emerald" | "gray"
}

const triggerToneClass: Record<NonNullable<DependencyHoverCardProps["tone"]>, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  gray: "border-gray-200 bg-gray-50 text-gray-700",
}

export default function DependencyHoverCard({
  title,
  items = [],
  emptyText = "暂无",
  tone = "gray",
}: DependencyHoverCardProps) {
  if (!items.length) {
    return <span className="text-gray-400">{emptyText}</span>
  }

  return (
    <div className="group/dep relative inline-flex">
      <span
        className={cn(
          "inline-flex cursor-default items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          triggerToneClass[tone]
        )}
      >
        {`共 ${items.length} 项`}
      </span>

      <div
        className={cn(
          "absolute left-0 top-full z-30 hidden min-w-52 max-w-80 rounded-md border border-gray-200 bg-white p-2 shadow-lg",
          "group-hover/dep:block group-focus-within/dep:block"
        )}
      >
        <span className="mb-1 block text-[11px] font-medium text-gray-500">{title}</span>
        <span className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {items.map((item, index) => (
            <span
              key={`${item.type ?? "ref"}-${item.field_key}-${index}`}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"
              title={`${item.type ?? "item"}/${item.field_key}`}
            >
              {item.label || item.field_key}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
