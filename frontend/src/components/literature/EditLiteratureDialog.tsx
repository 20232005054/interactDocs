"use client"

import { useState } from "react"
import { literatureService } from "@/services/literatureService"
import type { Literature } from "@/types/api"

interface EditLiteratureDialogProps {
  literature: Literature
  onClose: () => void
  onUpdated: (lit: Literature) => void
}

export default function EditLiteratureDialog({
  literature,
  onClose,
  onUpdated,
}: EditLiteratureDialogProps) {
  const [title, setTitle] = useState(literature.title ?? "")
  const [authors, setAuthors] = useState(literature.authors ?? "")
  const [journal, setJournal] = useState(literature.journal ?? "")
  const [doi, setDoi] = useState(literature.doi ?? "")
  const [impactFactor, setImpactFactor] = useState(
    literature.impact_factor != null ? String(literature.impact_factor) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload: {
      title?: string
      authors?: string
      journal?: string
      doi?: string
      impact_factor?: number
    } = {}

    if (title.trim() !== (literature.title ?? "")) payload.title = title.trim()
    if (authors.trim() !== (literature.authors ?? "")) payload.authors = authors.trim()
    if (journal.trim() !== (literature.journal ?? "")) payload.journal = journal.trim()
    if (doi.trim() !== (literature.doi ?? "")) payload.doi = doi.trim()

    const ifValue = impactFactor.trim() ? parseFloat(impactFactor) : null
    const oldIf = literature.impact_factor
    if (ifValue !== oldIf) {
      if (ifValue != null && !isNaN(ifValue) && ifValue >= 0) {
        payload.impact_factor = ifValue
      } else if (ifValue === null && oldIf != null) {
        payload.impact_factor = 0 // 清空 IF
      }
    }

    if (Object.keys(payload).length === 0) {
      setError("没有修改任何内容")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updated = await literatureService.update(literature.literature_id, payload)
      onUpdated(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full h-9 rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">编辑文献元数据</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="space-y-4">
            {/* 标题 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="文献标题"
                className={inputCls}
              />
            </div>

            {/* 作者 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">作者</label>
              <input
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="多个作者用逗号分隔"
                className={inputCls}
              />
            </div>

            {/* 期刊 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">期刊</label>
              <input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="期刊名称"
                className={inputCls}
              />
            </div>

            {/* DOI */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">DOI</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="10.xxxx/xxxxx"
                className={inputCls}
              />
            </div>

            {/* 影响因子 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">影响因子</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={impactFactor}
                onChange={(e) => setImpactFactor(e.target.value)}
                placeholder="例如: 5.2"
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">{error}</div>
          )}

          {/* 底部按钮 */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-9 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
