"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { summaryTemplateService, coreInfoTemplateService } from "@/services/templateService"
import type { SummaryTemplate, CoreInfoTemplate, SourceInfo, GenerationMode, SummaryDependencyItem } from "@/types/api"
import RichTextEditor from "@/components/editor/RichTextEditor"
import ReadonlySourceList from "@/components/template/ReadonlySourceList"
import DependencyHoverCard from "@/components/template/DependencyHoverCard"
import { cn } from "@/lib/utils"
import {
  appendVariableText,
  collectVariableKeys,
  getCoreInfoDragData,
  pruneCoreInfoSourcesByKeys,
  upsertCoreInfoSource,
  setSummaryDragData,
  type SummaryDragItem,
} from "@/lib/templateDrag"

interface SummaryTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
  dependencyItems?: SummaryDependencyItem[]
}

interface VariableOption {
  fieldKey: string
  label: string
}

const GENERATION_MODE_OPTIONS: Array<{ value: GenerationMode; label: string }> = [
  { value: 0, label: "复制" },
  { value: 1, label: "AI总结" },
  { value: 2, label: "直接使用" },
  { value: 3, label: "AI修改" },
]

function flattenCoreInfo(nodes: CoreInfoTemplate[]): VariableOption[] {
  const result: VariableOption[] = []
  const seen = new Set<string>()
  const walk = (list: CoreInfoTemplate[]) => {
    for (const node of list) {
      if (node.field_type !== "group") {
        if (!seen.has(node.field_key)) {
          seen.add(node.field_key)
          result.push({ fieldKey: node.field_key, label: node.field_name })
        }
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

interface SummaryCardProps {
  item: SummaryTemplate
  index: number
  variables: VariableOption[]
  onDelete: (id: string) => void
  isExpanded: boolean
  isEditing: boolean
  onEditingFocus: () => void
  onToggle: () => void
  dependencyItem?: SummaryDependencyItem
}

function SummaryCard({
  item,
  index,
  variables,
  onDelete,
  isExpanded,
  isEditing,
  onEditingFocus,
  onToggle,
  dependencyItem,
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
  const variableLabelMap = useMemo(
    () => Object.fromEntries(variables.map((item) => [item.fieldKey, item.label])),
    [variables]
  )

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

  const handleTitleChange = (value: string) => {
    setTitle(value)
    save({ title: value })
  }

  const handleModeChange = (value: GenerationMode) => {
    setGenerationMode(value)
    save({ generation_mode: value })
  }

  const handleSourcesChange = (value: SourceInfo[]) => {
    setSources(value)
    save({ sources: value })
  }

  const handleContentChange = (value: string) => {
    setContentTemplate(value)
    save({ content_template: value })
    const usedKeys = collectVariableKeys([value, defaultPrompt, customPrompt])
    const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
    if (JSON.stringify(nextSources) !== JSON.stringify(sources)) {
      handleSourcesChange(nextSources)
    }
  }

  const handleDefaultPromptChange = (value: string) => {
    setDefaultPrompt(value)
    save({ default_prompt: value })
    const usedKeys = collectVariableKeys([contentTemplate, value, customPrompt])
    const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
    if (JSON.stringify(nextSources) !== JSON.stringify(sources)) {
      handleSourcesChange(nextSources)
    }
  }

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value)
    save({ custom_prompt: value })
    const usedKeys = collectVariableKeys([contentTemplate, defaultPrompt, value])
    const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
    if (JSON.stringify(nextSources) !== JSON.stringify(sources)) {
      handleSourcesChange(nextSources)
    }
  }

  const showSources = generationMode !== 2
  const showPrompts = generationMode === 1 || generationMode === 3
  const generationModeLabel = GENERATION_MODE_OPTIONS.find((option) => option.value === generationMode)?.label ?? "未设置"

  const syncDroppedSource = (dropped: { fieldKey: string; label: string }) => {
    handleSourcesChange(upsertCoreInfoSource(sources, dropped))
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
    <div className="rounded-lg bg-white w-full" onFocusCapture={onEditingFocus}>
      <div
        className={cn(
          "flex items-center",
          isEditing && "sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur"
        )}
      >
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            const dragItem: SummaryDragItem = {
              fieldKey: item.field_key,
              label: title || "未命名摘要",
            }
            setSummaryDragData(event, dragItem)
          }}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-md px-2 py-1 text-left transition hover:bg-gray-50 cursor-move"
          aria-label={isExpanded ? "折叠摘要模板" : "展开摘要模板"}
          title="可拖拽到章节结构"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-700">
              {`摘要${index + 1} · ${title || "未命名摘要"}`}
            </div>
            {!isExpanded && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{generationModeLabel}</span>
                <span>{`${sources.length} 条来源映射`}</span>
              </div>
            )}
          </div>
          <span
            className={cn(
              "mt-0.5 text-xs text-gray-400 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
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

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 ">
            <div className="grid grid-cols-[minmax(0,1fr)_180px]">
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-sm text-gray-600">摘要标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="请输入"
                  className="h-8 min-w-0 w-full rounded border border-gray-300 px-2 text-sm outline-none transition focus:border-green-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">生成方式</label>
                <select
                  value={generationMode}
                  onChange={(event) => handleModeChange(Number(event.target.value) as GenerationMode)}
                  className="h-8 w-auto rounded border border-gray-300 bg-white px-2 text-sm outline-none transition focus:border-green-400"
                >
                  {GENERATION_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div className="flex flex-wrap items-start gap-2">
                <span className="shrink-0 text-gray-500">引用来源:</span>
                <DependencyHoverCard
                  title="引用来源详情"
                  items={dependencyItem?.references ?? []}
                  emptyText="暂无"
                  tone="blue"
                />
              </div>
              <div className="mt-1 flex flex-wrap items-start gap-2">
                <span className="shrink-0 text-gray-500">被章节引用:</span>
                <DependencyHoverCard
                  title="被章节引用详情"
                  items={dependencyItem?.referenced_by ?? []}
                  emptyText="暂无"
                  tone="emerald"
                />
              </div>
            </div>

            {showSources ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-600">来源方式：</label>
                <ReadonlySourceList sources={sources} />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                当前为“直接使用”模式，内容模板会原样写入摘要，不使用来源映射和变量替换。
              </div>
            )}

            <div className="relative">
              <RichTextEditor
                value={contentTemplate}
                onChange={handleContentChange}
                onVariableDrop={syncDroppedSource}
                variables={variables}
                placeholder="这里是一大段模板文字，可插入 {{变量}} 占位符..."
                minHeight="120px"
              />
              <p className="mt-2 text-xs text-gray-400">
                {generationMode === 2
                  ? "当前模式会直接使用这里的原文内容。"
                  : generationMode === 3
                    ? "这里的内容会作为草稿交给 AI 修改，支持拖入变量占位符。"
                    : "支持将核心信息字段拖入编辑区，自动插入变量占位符。"}
              </p>
            </div>

            {showPrompts && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>AI提示词：</span>
                  <button type="button" className="text-sm text-green-600 hover:underline">引用样例库</button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex w-full flex-col gap-1">
                    <span className="text-xs text-gray-500">默认提示词：</span>
                    <textarea
                      value={defaultPrompt}
                      onChange={(event) => handleDefaultPromptChange(event.target.value)}
                      onDragOver={(event) => {
                        const dropped = getCoreInfoDragData(event)
                        if (!dropped) return
                        event.preventDefault()
                      }}
                      onDrop={(event) => {
                        const dropped = getCoreInfoDragData(event)
                        if (!dropped) return
                        event.preventDefault()
                        handleDefaultPromptChange(appendVariableText(defaultPrompt, dropped))
                        syncDroppedSource(dropped)
                      }}
                      rows={6}
                      className="w-full resize-none rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-400"
                    />
                  </div>
                  <div className="flex w-full flex-col gap-1">
                    <span className="text-xs text-gray-500">自定义提示词：</span>
                    <textarea
                      value={customPrompt}
                      onChange={(event) => handleCustomPromptChange(event.target.value)}
                      onDragOver={(event) => {
                        const dropped = getCoreInfoDragData(event)
                        if (!dropped) return
                        event.preventDefault()
                      }}
                      onDrop={(event) => {
                        const dropped = getCoreInfoDragData(event)
                        if (!dropped) return
                        event.preventDefault()
                        handleCustomPromptChange(appendVariableText(customPrompt, dropped))
                        syncDroppedSource(dropped)
                      }}
                      rows={6}
                      className="w-full resize-none rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddSummaryForm({ templateId, onDone, onCancel }: {
  templateId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-lg border border-dashed border-green-300 bg-green-50 p-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="摘要标题"
        className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400"
      />
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="h-8 rounded bg-green-500 px-3 text-xs font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "创建中..." : "创建"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded border border-gray-300 px-3 text-xs text-gray-500 transition hover:bg-gray-50"
      >
        取消
      </button>
    </form>
  )
}

export default function SummaryTemplateStep({
  templateId,
  onCountChange,
  dependencyItems = [],
}: SummaryTemplateStepProps) {
  const [items, setItems] = useState<SummaryTemplate[]>([])
  const [coreInfoOptions, setCoreInfoOptions] = useState<VariableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null)
  const dependencyMap = useMemo(
    () => new Map(dependencyItems.map((item) => [item.field_key, item])),
    [dependencyItems]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, coreRes] = await Promise.all([
        summaryTemplateService.getByTemplate(templateId),
        coreInfoTemplateService.getByTemplate(templateId),
      ])
      setItems(summaryRes.items ?? [])
      setCoreInfoOptions(flattenCoreInfo(coreRes.items ?? []))
      setExpandedIds([])
      onCountChange?.(summaryRes.items?.length ?? 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange])

  useEffect(() => {
    load()
  }, [load])

  const variables = coreInfoOptions

  if (loading) {
    return (
      <div className="flex flex-col">
        {[1, 2].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>

  const toggleExpanded = (summaryTemplateId: string) => {
    setExpandedIds((prev) =>
      prev.includes(summaryTemplateId)
        ? prev.filter((id) => id !== summaryTemplateId)
        : [...prev, summaryTemplateId]
    )
  }

  return (
    <div className="flex flex-col">
      {items.map((item, index) => (
        <SummaryCard
          key={item.summary_template_id}
          item={item}
          index={index}
          variables={variables}
          isExpanded={expandedIds.includes(item.summary_template_id)}
          isEditing={editingSummaryId === item.summary_template_id}
          onEditingFocus={() => setEditingSummaryId(item.summary_template_id)}
          onToggle={() => toggleExpanded(item.summary_template_id)}
          dependencyItem={dependencyMap.get(item.field_key)}
          onDelete={(id) => {
            setItems((prev) => {
              const next = prev.filter((summary) => summary.summary_template_id !== id)
              onCountChange?.(next.length)
              return next
            })
            setEditingSummaryId((prev) => (prev === id ? null : prev))
            setExpandedIds((prev) => prev.filter((existingId) => existingId !== id))
          }}
        />
      ))}

      {adding ? (
        <AddSummaryForm
          templateId={templateId}
          onDone={() => {
            setAdding(false)
            load()
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="self-start h-8 rounded border border-green-400 px-4 text-sm font-medium text-green-600 transition hover:bg-green-50"
        >
          + 添加摘要
        </button>
      )}
    </div>
  )
}
