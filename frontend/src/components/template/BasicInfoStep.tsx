"use client"

import { useState } from "react"
import { templateService } from "@/services/templateService"
import type { TemplateDetail } from "@/types/api"

interface BasicInfoStepProps {
  templateId: string | null
  initialData?: TemplateDetail | null
  onSaved: (template: TemplateDetail) => void
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-20 shrink-0 text-sm text-gray-600 text-right">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

const inputCls = "h-9 rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 transition"
const selectCls = "h-9 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 transition"

export default function BasicInfoStep({ templateId, initialData, onSaved }: BasicInfoStepProps) {
  const [displayName, setDisplayName] = useState(initialData?.display_name ?? "")
  const [purpose, setPurpose] = useState(initialData?.purpose ?? "")
  const [isSystem, setIsSystem] = useState(initialData?.is_system ?? true)
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim() || !purpose.trim()) {
      setError("模板名称和用途为必填项")
      return
    }
    setLoading(true)
    setError(null)
    try {
      let result: TemplateDetail
      if (templateId) {
        result = await templateService.update(templateId, {
          display_name: displayName.trim(),
          purpose: purpose.trim(),
          is_system: isSystem,
          is_active: isActive,
        }) as unknown as TemplateDetail
        result = { ...result, document_id: initialData?.document_id ?? null }
      } else {
        result = await templateService.create({
          display_name: displayName.trim(),
          purpose: purpose.trim(),
          content: {},
          is_system: isSystem,
        })
      }
      onSaved(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 py-4 px-2 max-w-2xl">
      <FormRow label="用途" required>
        <input
          type="text"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder="如：临床试验方案"
          className={`${inputCls} w-52`}
        />
      </FormRow>

      <div className="flex items-center gap-8">
        <FormRow label="模板名称" required>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="如：肿瘤临床试验方案模板"
            className={`${inputCls} w-52`}
          />
        </FormRow>
        <FormRow label="版本号">
          <input
            type="text"
            value={initialData?.version ?? 1}
            readOnly
            className={`${inputCls} w-20 bg-gray-50 text-gray-400 cursor-not-allowed`}
          />
        </FormRow>
      </div>

      <div className="flex items-center gap-8">
        <FormRow label="模板类型">
          <select
            value={isSystem ? "system" : "user"}
            onChange={e => setIsSystem(e.target.value === "system")}
            className={`${selectCls} w-32`}
          >
            <option value="system">系统模板</option>
            <option value="user">用户模板</option>
          </select>
        </FormRow>
        <FormRow label="模板状态">
          <select
            value={isActive ? "active" : "inactive"}
            onChange={e => setIsActive(e.target.value === "active")}
            className={`${selectCls} w-24`}
          >
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </FormRow>
      </div>

      {error && <p className="text-sm text-red-500 pl-24">{error}</p>}

      <div className="pl-24">
        <button
          type="submit"
          disabled={loading}
          className="h-9 px-6 rounded bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition"
        >
          {loading ? "保存中..." : templateId ? "保存修改" : "创建并继续"}
        </button>
      </div>
    </form>
  )
}
