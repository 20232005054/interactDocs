"use client"

import { useState } from "react"
import { literatureService } from "@/services/literatureService"
import { cn } from "@/lib/utils"
import type { Literature } from "@/types/api"

interface UploadLiteratureDialogProps {
  onClose: () => void
  onUploaded: (lit: Literature) => void
}

export default function UploadLiteratureDialog({ onClose, onUploaded }: UploadLiteratureDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [journal, setJournal] = useState("")
  const [doi, setDoi] = useState("")
  const [impactFactor, setImpactFactor] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("只支持 PDF 格式文件")
        return
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("文件大小不能超过 50MB")
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("请选择文件")
      return
    }

    setUploading(true)
    setError(null)

    try {
      const payload: {
        file: File
        title?: string
        authors?: string
        journal?: string
        doi?: string
        impact_factor?: number
      } = { file }

      if (title.trim()) payload.title = title.trim()
      if (authors.trim()) payload.authors = authors.trim()
      if (journal.trim()) payload.journal = journal.trim()
      if (doi.trim()) payload.doi = doi.trim()
      if (impactFactor.trim()) {
        const ifValue = parseFloat(impactFactor)
        if (!isNaN(ifValue) && ifValue >= 0) {
          payload.impact_factor = ifValue
        }
      }

      const lit = await literatureService.upload(payload)
      onUploaded(lit)
    } catch (err: unknown) {
      // 特殊处理 409 冲突错误（文献已存在）
      if (err instanceof Error) {
        if (err.message.includes("该文献已存在")) {
          setError(err.message)
        } else if (err.message.includes("409")) {
          setError("该文献已存在，请勿重复上传")
        } else {
          setError(err.message)
        }
      } else {
        setError("上传失败")
      }
    } finally {
      setUploading(false)
    }
  }

  const inputCls = "w-full h-9 rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">上传文献</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              支持 PDF 格式，元数据可选填（系统会自动从 CrossRef 补全）
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* 文件选择 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-600 font-medium">
                PDF 文件 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={cn(
                    "flex items-center justify-center h-24 rounded-lg border-2 border-dashed cursor-pointer transition",
                    file
                      ? "border-green-300 bg-green-50"
                      : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
                  )}
                >
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-green-700">✓ {file.name}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-gray-500">点击选择 PDF 文件</p>
                      <p className="text-xs text-gray-400 mt-1">最大 50MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* 元数据（可选） */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">
                以下字段可选填，留空则由系统自动从 CrossRef 解析
              </p>

              <div className="space-y-3">
                {/* 标题 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-gray-600">标题</label>
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
                  <label className="text-sm text-gray-600">作者</label>
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
                  <label className="text-sm text-gray-600">期刊</label>
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
                  <label className="text-sm text-gray-600">DOI</label>
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
                  <label className="text-sm text-gray-600">影响因子</label>
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
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-sm text-red-600">{error}</div>
          )}
        </form>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 h-9 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={uploading || !file}
            className="flex-1 h-9 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
          >
            {uploading ? "上传中..." : "上传"}
          </button>
        </div>
      </div>
    </div>
  )
}
