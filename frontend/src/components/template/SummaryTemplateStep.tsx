"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { summaryTemplateService, coreInfoTemplateService, structureTemplateService } from "@/services/templateService"
import type { SummaryTemplate, CoreInfoTemplate, StructureTemplate, SourceInfo, GenerationMode } from "@/types/api"
import RichTextEditor from "@/components/editor/RichTextEditor"

interface SummaryTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
}

interface VariableOption {
  fieldKey: string
  label: string
}

// 来源类型选项
const SOURCE_TYPE_OPTIONS = [
  { value: "keyinfo", label: "核心信息" },
  { value: "summary", label: "摘要" },
  { value: "chapter", label: "章节" },
]

// 匹配方式选项
const MATCH_TYPE_OPTIONS = [
  { value: "keyinfo_match", label: "核心信息匹配" },
  { value: "summary_match", label: "摘要匹配" },
  { value: "chapter_match", label: "章节匹配" },
]

function flattenCoreInfo(nodes: CoreInfoTemplate[]): VariableOption[] {
  const result: VariableOption[] = []
  const walk = (list: CoreInfoTemplate[]) => {
    for (const n of list) {
      if (n.field_type !== "group") result.push({ fieldKey: n.field_key, label: n.field_name })
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

function flattenStructure(nodes: StructureTemplate[]): VariableOption[] {
  const result: VariableOption[] = []
  const walk = (list: StructureTemplate[]) => {
    for (const n of list) {
      result.push({ fieldKey: n.field_key, label: n.title })
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

// ----------------------------------------------------------------
// 来源行组件
// ----------------------------------------------------------------
interface SourceRowProps {
  source: SourceInfo
  coreInfoOptions: VariableOption[]
  summaryOptions: VariableOption[]
  structureOptions: VariableOption[]
  onChange: (updated: SourceInfo) => void
  onRemove: () => void
}

function SourceRow({ source, coreInfoOptions, summaryOptions, structureOptions, onChange, onRemove }: SourceRowProps) {
  const sourceType = source.source.value

  const matchKeyOptions: VariableOption[] =
    sourceType === "keyinfo" ? coreInfoOptions :
    sourceType === "summary" ? summaryOptions :
    structureOptions

  const selectedKeys = source.match_keys.map(k => k.value)

  const toggleKey = (opt: VariableOption) => {
    const exists = selectedKeys.includes(opt.fieldKey)
    const newKeys = exists
      ? source.match_keys.filter(k => k.value !== opt.fieldKey)
      : [...source.match_keys, { value: opt.fieldKey, label: opt.label }]
    onChange({ ...source, match_keys: newKeys })
  }

  const removeKey = (val: string) => {
    onChange({ ...source, match_keys: source.match_keys.filter(k => k.value !== val) })
  }

  return (
    <div className="flex items-start gap-2">
      {/* 拖拽图标占位 */}
      <span className="mt-2 text-gray-300 cursor-grab select-none">≡</span>

      {/* 来源类型 */}
      <select
        value={sourceType}
        onChange={e => onChange({
          ...source,
          source: { value: e.target.value, label: SOURCE_TYPE_OPTIONS.find(o => o.value === e.target.value)?.label ?? e.target.value },
          match_keys: [],
        })}
        className="h-9 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 transition w-32"
      >
        {SOURCE_TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* 匹配方式 */}
      <select
        value={source.match_type}
        onChange={e => onChange({ ...source, match_type: e.target.value })}
        className="h-9 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 transition w-36"
      >
        {MATCH_TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* 匹配字段多选 tag */}
      <div className="flex-1 min-h-9 rounded border border-gray-300 bg-white px-2 py-1 flex flex-wrap gap-1 items-center relative">
        {source.match_keys.map(k => (
          <span key={k.value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
            {k.label}
            <button type="button" onClick={() => removeKey(k.value)} className="hover:text-red-500 leading-none">×</button>
          </span>
        ))}
        {/* 下拉选择器 */}
        <MatchKeyDropdown options={matchKeyOptions} selectedKeys={selectedKeys} onToggle={toggleKey} />
      </div>

      {/* 删除行 */}
      <button type="button" onClick={onRemove} className="mt-2 text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
    </div>
  )
}

// 匹配字段下拉
function MatchKeyDropdown({ options, selectedKeys, onToggle }: {
  options: VariableOption[]
  selectedKeys: string[]
  onToggle: (opt: VariableOption) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-6 px-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded"
      >
        ▾
      </button>
      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-md min-w-36 py-1 max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.fieldKey}
              type="button"
              onClick={() => onToggle(opt)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span className={`w-3 h-3 rounded-sm border flex-shrink-0 ${selectedKeys.includes(opt.fieldKey) ? "bg-green-500 border-green-500" : "border-gray-300"}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 单条摘要模板卡片（展开显示，实时保存）
// ----------------------------------------------------------------
interface SummaryCardProps {
  item: SummaryTemplate
  index: number
  templateId: string
  coreInfoOptions: VariableOption[]
  summaryOptions: VariableOption[]
  structureOptions: VariableOption[]
  variables: VariableOption[]
  onRefresh: () => void
  onDelete: (id: string) => void
}

function SummaryCard({
  item, index, templateId,
  coreInfoOptions, summaryOptions, structureOptions,
  variables, onRefresh, onDelete,
}: SummaryCardProps) {
  const [title, setTitle] = useState(item.title)
  const [generationMode, setGenerationMode] = useState<GenerationMode>(item.generation_mode)
  const [sources, setSources] = useState<SourceInfo[]>(item.sources ?? [])
  const [contentTemplate, setContentTemplate] = useState(item.content_template ?? "")
  const [defaultPrompt, setDefaultPrompt] = useState(item.default_prompt ?? "")
  const [customPrompt, setCustomPrompt] = useState(item.custom_prompt ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (patch: Partial<{
    title: string
    generation_mode: GenerationMode
    sources: SourceInfo[]
    content_template: string
    default_prompt: string
    custom_prompt: string
  }>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await summaryTemplateService.update(item.summary_template_id, patch)
      } finally {
        setSaving(false)
      }
    }, 600)
  }, [item.summary_template_id])

  const handleTitleChange = (v: string) => { setTitle(v); save({ title: v }) }
  const handleModeChange = (v: GenerationMode) => { setGenerationMode(v); save({ generation_mode: v }) }
  const handleSourcesChange = (v: SourceInfo[]) => { setSources(v); save({ sources: v }) }
  const handleContentChange = (v: string) => { setContentTemplate(v); save({ content_template: v }) }
  const handleDefaultPromptChange = (v: string) => { setDefaultPrompt(v); save({ default_prompt: v }) }
  const handleCustomPromptChange = (v: string) => { setCustomPrompt(v); save({ custom_prompt: v }) }

  const addSource = () => {
    const newSources: SourceInfo[] = [...sources, {
      source: { value: "keyinfo", label: "核心信息" },
      match_type: "keyinfo_match",
      match_keys: [],
    }]
    handleSourcesChange(newSources)
  }

  const handleDelete = async () => {
    try {
      await summaryTemplateService.delete(item.summary_template_id)
      onDelete(item.summary_template_id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white flex flex-col gap-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">摘要{index + 1}</span>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">保存中...</span>}
          {deleting ? (
            <>
              <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">确认删除</button>
              <button onClick={() => setDeleting(false)} className="text-xs text-gray-400 hover:underline">取消</button>
            </>
          ) : (
            <button onClick={() => setDeleting(true)} className="text-xs text-gray-400 hover:text-red-400">删除</button>
          )}
        </div>
      </div>

      {/* 摘要标题 */}
      <div className="flex items-center gap-3">
        <label className="w-16 text-sm text-gray-600 shrink-0">摘要标题：</label>
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="请输入"
          className="w-48 h-8 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400 transition"
        />
      </div>

      {/* 生成方式 */}
      <div className="flex items-center gap-3">
        <label className="w-16 text-sm text-gray-600 shrink-0">生成方式：</label>
        <select
          value={generationMode}
          onChange={e => handleModeChange(Number(e.target.value) as GenerationMode)}
          className="h-8 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 transition w-28"
        >
          <option value={0}>复制</option>
          <option value={1}>AI生成</option>
          <option value={2}>直接使用</option>
          <option value={3}>AI修改</option>
        </select>
        <span className="text-xs text-gray-400">
          {generationMode === 0 && "变量替换模板内容"}
          {generationMode === 1 && "AI 根据来源数据生成"}
          {generationMode === 2 && "固定内容，不受变更影响"}
          {generationMode === 3 && "AI 润色模板草稿"}
        </span>
      </div>

      {/* 来源方式（mode=2 不需要） */}
      {generationMode !== 2 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600">来源方式：</label>
          <div className="flex flex-col gap-2 pl-2">
            {sources.map((src, i) => (
              <SourceRow
                key={i}
                source={src}
                coreInfoOptions={coreInfoOptions}
                summaryOptions={summaryOptions}
                structureOptions={structureOptions}
                onChange={updated => {
                  const next = sources.map((s, idx) => idx === i ? updated : s)
                  handleSourcesChange(next)
                }}
                onRemove={() => handleSourcesChange(sources.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={addSource}
              className="self-start text-sm text-green-600 hover:text-green-700 font-medium"
            >
              + 添加来源
            </button>
          </div>
        </div>
      )}

      {/* 内容模板（富文本） */}
      <div className="relative">
        <RichTextEditor
          value={contentTemplate}
          onChange={handleContentChange}
          variables={variables}
          placeholder={
            generationMode === 2
              ? "直接使用模式：输入固定内容，不插入变量..."
              : generationMode === 3
              ? "AI修改模式：输入草稿内容，AI 将基于此润色..."
              : "这里是一大段模板文字，可插入 {{变量}} 占位符..."
          }
          minHeight="120px"
        />
      </div>

      {/* AI 模式：提示词双栏（mode=1 和 mode=3） */}
      {(generationMode === 1 || generationMode === 3) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>AI提示词：</span>
            <button type="button" className="text-green-600 hover:underline text-sm">引用样例库</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">默认提示词：</span>
              <textarea
                value={defaultPrompt}
                onChange={e => handleDefaultPromptChange(e.target.value)}
                rows={6}
                className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-400 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">自定义提示词：</span>
              <textarea
                value={customPrompt}
                onChange={e => handleCustomPromptChange(e.target.value)}
                rows={6}
                className="rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400 resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 新建摘要表单（轻量）
// ----------------------------------------------------------------
function AddSummaryForm({ templateId, onDone, onCancel }: {
  templateId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      await summaryTemplateService.create({ template_id: templateId, title: title.trim() })
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border border-dashed border-green-300 rounded-lg bg-green-50">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="摘要标题"
        className="flex-1 h-8 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400"
      />
      <button type="submit" disabled={loading || !title.trim()}
        className="h-8 px-3 rounded bg-green-500 text-white text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition">
        {loading ? "创建中..." : "创建"}
      </button>
      <button type="button" onClick={onCancel}
        className="h-8 px-3 rounded border border-gray-300 text-xs text-gray-500 hover:bg-gray-50 transition">
        取消
      </button>
    </form>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function SummaryTemplateStep({ templateId, onCountChange }: SummaryTemplateStepProps) {
  const [items, setItems] = useState<SummaryTemplate[]>([])
  const [coreInfoOptions, setCoreInfoOptions] = useState<VariableOption[]>([])
  const [summaryOptions, setSummaryOptions] = useState<VariableOption[]>([])
  const [structureOptions, setStructureOptions] = useState<VariableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, coreRes, structureRes] = await Promise.all([
        summaryTemplateService.getByTemplate(templateId),
        coreInfoTemplateService.getByTemplate(templateId),
        structureTemplateService.getByTemplate(templateId),
      ])
      setItems(summaryRes.items ?? [])
      setCoreInfoOptions(flattenCoreInfo(coreRes.items ?? []))
      setSummaryOptions((summaryRes.items ?? []).map(s => ({ fieldKey: s.field_key, label: s.title })))
      setStructureOptions(flattenStructure(structureRes.tree ?? []))
      onCountChange?.(summaryRes.items?.length ?? 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange])

  useEffect(() => { load() }, [load])

  // 所有可插入变量 = 核心信息字段
  const variables = coreInfoOptions

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  if (error) return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, idx) => (
        <SummaryCard
          key={item.summary_template_id}
          item={item}
          index={idx}
          templateId={templateId}
          coreInfoOptions={coreInfoOptions}
          summaryOptions={summaryOptions}
          structureOptions={structureOptions}
          variables={variables}
          onRefresh={load}
          onDelete={() => {
            setItems(prev => prev.filter(i => i.summary_template_id !== item.summary_template_id))
            onCountChange?.(items.length - 1)
          }}
        />
      ))}

      {adding ? (
        <AddSummaryForm
          templateId={templateId}
          onDone={() => { setAdding(false); load() }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="self-start h-8 px-4 rounded border border-green-400 text-green-600 text-sm font-medium hover:bg-green-50 transition"
        >
          + 添加摘要
        </button>
      )}
    </div>
  )
}
