"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CoreInfo } from "@/types/api"

interface CreateCoreInfoDialogProps {
  open: boolean
  onConfirm: (data: {
    title: string
    field_type: string
    parent_id: string | null
    is_required: boolean
    options?: string[]
  }) => void
  onCancel: () => void
  coreInfoTree: CoreInfo[]
}

export default function CreateCoreInfoDialog({
  open,
  onConfirm,
  onCancel,
  coreInfoTree,
}: CreateCoreInfoDialogProps) {
  const [title, setTitle] = useState("")
  const [fieldType, setFieldType] = useState<string>("text")
  const [parentId, setParentId] = useState<string | null>(null)
  const [isRequired, setIsRequired] = useState(true)
  const [options, setOptions] = useState("")
  const [isComposing, setIsComposing] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle("")
      setFieldType("text")
      setParentId(null)
      setIsRequired(true)
      setOptions("")
    }
  }, [open])

  const handleConfirm = () => {
    if (!title.trim() || isComposing) return

    const data: {
      title: string
      field_type: string
      parent_id: string | null
      is_required: boolean
      options?: string[]
    } = {
      title: title.trim(),
      field_type: fieldType,
      parent_id: parentId,
      is_required: isRequired,
    }

    if (fieldType === "select" && options.trim()) {
      data.options = options.split("\n").map((opt) => opt.trim()).filter(Boolean)
    }

    onConfirm(data)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && fieldType !== "select" && !isComposing) {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === "Escape") {
      onCancel()
    }
  }

  // 扁平化树形结构，用于父节点选择
  const flattenTree = (tree: CoreInfo[], depth = 0): Array<{ node: CoreInfo; depth: number }> => {
    const result: Array<{ node: CoreInfo; depth: number }> = []
    tree.forEach((node) => {
      result.push({ node, depth })
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1))
      }
    })
    return result
  }

  const flatNodes = flattenTree(coreInfoTree)

  if (!open) return null

  return (
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black/30 z-50 animate-in fade-in duration-200" onClick={onCancel} />

      {/* 对话框 */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-lg shadow-xl animate-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">新建核心信息</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-4">
          {/* 标题 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(e) => {
                setIsComposing(false)
              }}
              onKeyDown={handleKeyDown}
              placeholder="请输入核心信息标题"
              className="w-full h-9 rounded border border-gray-200 px-3 text-sm outline-none focus:border-blue-300 transition"
              autoFocus
            />
          </div>

          {/* 字段类型 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">字段类型</label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className="w-full h-9 rounded border border-gray-200 px-3 text-sm outline-none focus:border-blue-300 transition"
            >
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="select">下拉选择</option>
              <option value="group">分组</option>
            </select>
          </div>

          {/* 下拉选项（仅 select 类型） */}
          {fieldType === "select" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                选项列表（每行一个）
              </label>
              <textarea
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false)
                }}
                placeholder="选项1&#10;选项2&#10;选项3"
                rows={4}
                className="w-full resize-none rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-300 transition"
              />
            </div>
          )}

          {/* 父节点选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              父节点（可选）
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full h-9 rounded border border-gray-200 px-3 text-sm outline-none focus:border-blue-300 transition"
            >
              <option value="">无（根节点）</option>
              {flatNodes
                .filter((item) => item.node.field_type === "group")
                .map((item) => (
                  <option key={item.node.core_info_id} value={item.node.core_info_id}>
                    {"　".repeat(item.depth)}{item.node.title}
                  </option>
                ))}
            </select>
          </div>

          {/* 是否必填（非 group 类型） */}
          {fieldType !== "group" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-required"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-300"
              />
              <label htmlFor="is-required" className="text-xs text-gray-700 cursor-pointer">
                必填字段
              </label>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-4 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!title.trim()}
            className={cn(
              "h-8 px-4 rounded text-sm font-medium transition",
              title.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            创建
          </button>
        </div>
      </div>
    </>
  )
}
