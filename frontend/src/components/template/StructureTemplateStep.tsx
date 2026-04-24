"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { ChevronDown, CornerDownRight, Plus } from "lucide-react"
import { structureTemplateService, coreInfoTemplateService } from "@/services/templateService"
import type {
  StructureTemplate,
  StructureTemplateParagraphDef,
  CoreInfoTemplate,
  SourceInfo,
  GenerationMode,
  StructureDependencyItem,
} from "@/types/api"
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
} from "@/lib/templateDrag"
import { toastError } from "@/hooks/useToast"

interface StructureTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
  dependencyItems?: StructureDependencyItem[]
  stickyOutline?: boolean
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

function countTree(nodes: StructureTemplate[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countTree(node.children ?? []), 0)
}

function findNodeById(nodes: StructureTemplate[], nodeId: string | null): StructureTemplate | null {
  if (!nodeId) return null
  for (const node of nodes) {
    if (node.structure_template_id === nodeId) return node
    const found = findNodeById(node.children ?? [], nodeId)
    if (found) return found
  }
  return null
}

function getInitialParagraphs(node: StructureTemplate): StructureTemplateParagraphDef[] {
  if (Array.isArray(node.paragraphs) && node.paragraphs.length > 0) {
    return node.paragraphs
  }
  // 兼容旧数据：字段直接挂在 node 上
  return [{
    para_type: "paragraph",
    generation_mode: node.generation_mode ?? 2,
    content_template: node.content_template ?? "",
    sources: node.sources ?? [],
    default_prompt: node.default_prompt ?? "",
    custom_prompt: node.custom_prompt ?? "",
  }]
}

// ----------------------------------------------------------------
// 单个段落编辑器
// ----------------------------------------------------------------
interface ParagraphEditorProps {
  index: number
  total: number
  para: StructureTemplateParagraphDef
  variables: VariableOption[]
  variableLabelMap: Record<string, string>
  onChange: (index: number, next: StructureTemplateParagraphDef) => void
  onDelete: (index: number) => void
}

function ParagraphEditor({ index, total, para, variables, variableLabelMap, onChange, onDelete }: ParagraphEditorProps) {
  const generationMode = (para.generation_mode ?? 2) as GenerationMode
  const sources = para.sources ?? []
  const contentTemplate = para.content_template ?? ""
  const defaultPrompt = para.default_prompt ?? ""
  const customPrompt = para.custom_prompt ?? ""

  const patch = useCallback((fields: Partial<StructureTemplateParagraphDef>) => {
    onChange(index, { ...para, ...fields })
  }, [index, onChange, para])

  const handleSourcesChange = useCallback((next: SourceInfo[]) => {
    patch({ sources: next })
  }, [patch])

  const syncDroppedSource = useCallback((dropped: { fieldKey: string; label: string }) => {
    handleSourcesChange(upsertCoreInfoSource(sources, dropped))
  }, [handleSourcesChange, sources])

  const showSources = generationMode !== 2
  const showPrompts = generationMode === 1 || generationMode === 3

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      {/* 段落头部 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">段落 {index + 1}</span>
        {total > 1 && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="text-xs text-gray-400 hover:text-red-400 transition"
          >
            删除段落
          </button>
        )}
      </div>

      {/* 生成方式 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-600">生成方式</label>
        <select
          value={generationMode}
          onChange={(event) => patch({ generation_mode: Number(event.target.value) as GenerationMode })}
          className="h-8 w-28 rounded border border-gray-300 bg-white px-2 text-sm outline-none transition focus:border-green-400"
        >
          {GENERATION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* 来源 */}
      {showSources ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600">来源方式：</label>
          <ReadonlySourceList sources={sources} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          "直接使用"模式，内容模板原样写入正文，不使用来源映射。
        </div>
      )}

      {/* 内容模板 */}
      <RichTextEditor
        value={contentTemplate}
        onChange={(value) => {
          const usedKeys = collectVariableKeys([value, defaultPrompt, customPrompt])
          const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
          patch({
            content_template: value,
            sources: JSON.stringify(nextSources) !== JSON.stringify(sources) ? nextSources : sources,
          })
        }}
        onVariableDrop={syncDroppedSource}
        variables={variables}
        placeholder="这里是一大段模板文字，可插入 {{变量}} 占位符..."
        minHeight="100px"
      />
      <p className="text-xs text-gray-400">
        {generationMode === 2
          ? "当前模式会直接使用这里的原文内容。"
          : generationMode === 3
            ? "这里的内容会作为草稿交给 AI 修改，支持拖入变量占位符。"
            : "支持将核心信息字段拖入编辑区，自动插入变量占位符。"}
      </p>

      {/* 提示词 */}
      {showPrompts && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-gray-600">AI提示词：</span>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">默认提示词：</span>
              <textarea
                value={defaultPrompt}
                onChange={(event) => {
                  const value = event.target.value
                  const usedKeys = collectVariableKeys([contentTemplate, value, customPrompt])
                  const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
                  patch({
                    default_prompt: value,
                    sources: JSON.stringify(nextSources) !== JSON.stringify(sources) ? nextSources : sources,
                  })
                }}
                onDragOver={(event) => { if (getCoreInfoDragData(event)) event.preventDefault() }}
                onDrop={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                  const next = appendVariableText(defaultPrompt, dropped)
                  patch({ default_prompt: next })
                  syncDroppedSource(dropped)
                }}
                rows={5}
                className="w-full resize-none rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">自定义提示词：</span>
              <textarea
                value={customPrompt}
                onChange={(event) => {
                  const value = event.target.value
                  const usedKeys = collectVariableKeys([contentTemplate, defaultPrompt, value])
                  const nextSources = pruneCoreInfoSourcesByKeys(sources, usedKeys, variableLabelMap)
                  patch({
                    custom_prompt: value,
                    sources: JSON.stringify(nextSources) !== JSON.stringify(sources) ? nextSources : sources,
                  })
                }}
                onDragOver={(event) => { if (getCoreInfoDragData(event)) event.preventDefault() }}
                onDrop={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                  const next = appendVariableText(customPrompt, dropped)
                  patch({ custom_prompt: next })
                  syncDroppedSource(dropped)
                }}
                rows={5}
                className="w-full resize-none rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// EditPanel：章节标题 + 多段落列表
// ----------------------------------------------------------------
interface EditPanelProps {
  node: StructureTemplate
  variables: VariableOption[]
  onDeleted: () => void
  dependencyItem?: StructureDependencyItem
}

function EditPanel({ node, variables, onDeleted, dependencyItem }: EditPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [paragraphs, setParagraphs] = useState<StructureTemplateParagraphDef[]>(() => getInitialParagraphs(node))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const variableLabelMap = useMemo(
    () => Object.fromEntries(variables.map((item) => [item.fieldKey, item.label])),
    [variables]
  )

  // 切换节点时重置状态
  useEffect(() => {
    setTitle(node.title)
    setParagraphs(getInitialParagraphs(node))
  }, [node.structure_template_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveAll = useCallback((nextTitle: string, nextParagraphs: StructureTemplateParagraphDef[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await structureTemplateService.update(node.structure_template_id, {
          title: nextTitle,
          paragraphs: nextParagraphs,
        })
      } finally {
        setSaving(false)
      }
    }, 600)
  }, [node.structure_template_id])

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value)
    saveAll(value, paragraphs)
  }, [paragraphs, saveAll])

  const handleParagraphChange = useCallback((index: number, next: StructureTemplateParagraphDef) => {
    setParagraphs((prev) => {
      const updated = prev.map((p, i) => i === index ? next : p)
      saveAll(title, updated)
      return updated
    })
  }, [saveAll, title])

  const handleParagraphDelete = useCallback((index: number) => {
    setParagraphs((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      saveAll(title, updated)
      return updated
    })
  }, [saveAll, title])

  const handleAddParagraph = useCallback(() => {
    setParagraphs((prev) => {
      const updated = [...prev, {
        para_type: "paragraph" as const,
        generation_mode: 2 as GenerationMode,
        content_template: "",
        sources: [],
        default_prompt: "",
        custom_prompt: "",
      }]
      saveAll(title, updated)
      return updated
    })
  }, [saveAll, title])

  const handleDelete = async () => {
    try {
      await structureTemplateService.delete(node.structure_template_id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* 头部：标题 + 删除章节 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{node.title}</span>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">保存中...</span>}
          {deleting ? (
            <>
              <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">确认删除</button>
              <button onClick={() => setDeleting(false)} className="text-xs text-gray-400 hover:underline">取消</button>
            </>
          ) : (
            <button onClick={() => setDeleting(true)} className="text-xs text-gray-400 hover:text-red-400">删除章节</button>
          )}
        </div>
      </div>

      {/* 章节标题输入 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-600">章节标题：</label>
        <input
          type="text"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="请输入"
          className="h-8 w-48 rounded border border-gray-300 px-2 text-sm outline-none transition focus:border-green-400"
        />
      </div>

      {/* 依赖来源 */}
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
      </div>

      {/* 多段落列表 */}
      <div className="flex flex-col gap-3">
        {paragraphs.map((para, index) => (
          <ParagraphEditor
            key={index}
            index={index}
            total={paragraphs.length}
            para={para}
            variables={variables}
            variableLabelMap={variableLabelMap}
            onChange={handleParagraphChange}
            onDelete={handleParagraphDelete}
          />
        ))}
      </div>

      {/* 添加段落 */}
      <button
        type="button"
        onClick={handleAddParagraph}
        className="h-8 w-full rounded border border-dashed border-green-400 text-xs font-medium text-green-600 transition hover:bg-green-50"
      >
        + 添加段落
      </button>
    </div>
  )
}


interface TreeItemProps {
  node: StructureTemplate
  templateId: string
  depth: number
  selectedId: string | null
  onSelect: (node: StructureTemplate) => void
  onCreated: (nodeId: string) => void
  onReload: () => void
  sortDragging: { id: string; parentId: string | null } | null
  sortOver: { id: string; parentId: string | null } | null
  onSortDragStart: (id: string, parentId: string | null) => void
  onSortDragEnd: () => void
  onSortDragEnter: (targetId: string, targetParentId: string | null) => void
  onSortDrop: (targetId: string, targetParentId: string | null) => Promise<void>
}

function TreeItem({
  node,
  templateId,
  depth,
  selectedId,
  onSelect,
  onCreated,
  onReload,
  sortDragging,
  sortOver,
  onSortDragStart,
  onSortDragEnd,
  onSortDragEnter,
  onSortDrop,
}: TreeItemProps) {
  const [addingSibling, setAddingSibling] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const isSelected = node.structure_template_id === selectedId
  const hasChildren = (node.children?.length ?? 0) > 0
  const canDropSort = !!sortDragging
    && sortDragging.parentId === node.parent_id
    && sortDragging.id !== node.structure_template_id
  const isSortOver = canDropSort
    && !!sortOver
    && sortOver.id === node.structure_template_id
    && sortOver.parentId === node.parent_id

  useEffect(() => {
    if (!addMenuOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [addMenuOpen])

  return (
    <div>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move"
          onSortDragStart(node.structure_template_id, node.parent_id)
        }}
        onDragEnd={onSortDragEnd}
        onDragOver={(event) => {
          if (!canDropSort) return
          event.preventDefault()
          onSortDragEnter(node.structure_template_id, node.parent_id)
        }}
        onDragEnter={(event) => {
          if (!canDropSort) return
          event.preventDefault()
          onSortDragEnter(node.structure_template_id, node.parent_id)
        }}
        onDrop={async (event) => {
          if (!canDropSort) return
          event.preventDefault()
          event.stopPropagation()
          await onSortDrop(node.structure_template_id, node.parent_id)
        }}
        className={cn(
          "group relative rounded-sm",
          isSortOver && "ring-1 ring-green-400/60 bg-green-50"
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(node)}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          className={
            isSelected
              ? "w-full rounded-sm bg-green-500 py-2 pr-24 text-left text-sm font-medium text-white transition"
              : "w-full rounded-sm py-2 pr-24 text-left text-sm text-gray-700 transition hover:bg-gray-100"
          }
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              onClick={(event) => {
                event.stopPropagation()
                if (!hasChildren) return
                setCollapsed((prev) => !prev)
              }}
              className={cn(
                "inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px] transition-transform",
                isSelected ? "text-white/90" : "text-gray-400",
                !hasChildren && "invisible",
                collapsed && "-rotate-90"
              )}
            >
              ▾
            </span>
            <span className="truncate">{node.title}</span>
          </span>
        </button>

        <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition group-hover:opacity-100">
          <div ref={addMenuRef} className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setAddMenuOpen((prev) => !prev)
              }}
              className="inline-flex h-6 items-center gap-1 rounded border border-gray-300 bg-white px-2 text-[11px] text-gray-600 hover:bg-gray-50"
              title="添加节点"
            >
              <Plus className="h-3.5 w-3.5" />
              <ChevronDown className={cn("h-3 w-3 transition-transform", addMenuOpen && "rotate-180")} />
            </button>

            {addMenuOpen && (
              <div
                className="absolute right-0 top-7 z-20 min-w-28 rounded-md border border-gray-200 bg-white p-1 shadow-md"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAddingSibling(true)
                    setAddingChild(false)
                    setAddMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3.5 w-3.5 text-gray-400" />
                  插入同级节点
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingChild(true)
                    setAddingSibling(false)
                    setAddMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <CornerDownRight className="h-3.5 w-3.5 text-gray-400" />
                  插入子级节点
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {addingSibling && (
        <AddStructureForm
          templateId={templateId}
          parentId={node.parent_id}
          parentLevel={node.level}
          afterId={node.structure_template_id}
          onDone={(newId) => {
            setAddingSibling(false)
            onCreated(newId)
            onReload()
          }}
          onCancel={() => setAddingSibling(false)}
        />
      )}

      {addingChild && (
        <AddStructureForm
          templateId={templateId}
          parentId={node.structure_template_id}
          parentLevel={node.level}
          onDone={(newId) => {
            setAddingChild(false)
            onCreated(newId)
            onReload()
          }}
          onCancel={() => setAddingChild(false)}
        />
      )}

      {!collapsed && node.children?.map((child) => (
        <TreeItem
          key={child.structure_template_id}
          node={child}
          templateId={templateId}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreated={onCreated}
          onReload={onReload}
          sortDragging={sortDragging}
          sortOver={sortOver}
          onSortDragStart={onSortDragStart}
          onSortDragEnd={onSortDragEnd}
          onSortDragEnter={onSortDragEnter}
          onSortDrop={onSortDrop}
        />
      ))}
    </div>
  )
}

function AddStructureForm({ templateId, parentId, parentLevel, afterId, onDone, onCancel }: {
  templateId: string
  parentId: string | null
  parentLevel: number
  afterId?: string
  onDone: (nodeId: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const submittedRef = useRef(false)
  const skipBlurSaveRef = useRef(false)

  const createNode = useCallback(async () => {
    if (submittedRef.current) return
    const nextTitle = title.trim()
    if (!nextTitle) {
      onCancel()
      return
    }

    submittedRef.current = true
    setLoading(true)
    try {
      if (afterId) {
        const created = await structureTemplateService.insertAfter(templateId, {
          after_id: afterId,
          title: nextTitle,
          level: parentLevel,
        })
        onDone(created.structure_template_id)
      } else {
        const created = await structureTemplateService.create({
          template_id: templateId,
          parent_id: parentId,
          title: nextTitle,
          level: parentLevel + 1,
        })
        onDone(created.structure_template_id)
      }
    } finally {
      setLoading(false)
    }
  }, [afterId, onCancel, onDone, parentId, parentLevel, templateId, title])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await createNode()
  }

  return (
    <form onSubmit={handleSubmit} className="mx-2 mt-1 flex items-center gap-2 rounded border border-dashed border-green-300 bg-green-50 p-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          if (skipBlurSaveRef.current) {
            skipBlurSaveRef.current = false
            return
          }
          void createNode()
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder="章节标题"
        className="h-7 flex-1 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400"
      />
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="h-7 rounded bg-green-500 px-2 text-xs text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "..." : "创建"}
      </button>
      <button
        type="button"
        onMouseDown={() => {
          skipBlurSaveRef.current = true
        }}
        onClick={onCancel}
        className="h-7 rounded border border-gray-300 px-2 text-xs text-gray-500 transition hover:bg-gray-50"
      >
        取消
      </button>
    </form>
  )
}

export default function StructureTemplateStep({
  templateId,
  onCountChange,
  dependencyItems = [],
  stickyOutline = false,
}: StructureTemplateStepProps) {
  const [tree, setTree] = useState<StructureTemplate[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [coreInfoOptions, setCoreInfoOptions] = useState<VariableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [sortDragging, setSortDragging] = useState<{ id: string; parentId: string | null } | null>(null)
  const [sortOver, setSortOver] = useState<{ id: string; parentId: string | null } | null>(null)
  const sortDraggingRef = useRef<{ id: string; parentId: string | null } | null>(null)
  const sortOverRef = useRef<{ id: string; parentId: string | null } | null>(null)
  const dependencyMap = useMemo(
    () => new Map(dependencyItems.map((item) => [item.field_key, item])),
    [dependencyItems]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [structureRes, coreRes] = await Promise.all([
        structureTemplateService.getByTemplate(templateId),
        coreInfoTemplateService.getByTemplate(templateId),
      ])
      const nextTree = structureRes.tree ?? []
      setTree(nextTree)
      setCoreInfoOptions(flattenCoreInfo(coreRes.items ?? []))
      onCountChange?.(countTree(nextTree))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange])

  useEffect(() => {
    load()
  }, [load])

  const selectedNode = useMemo(
    () => findNodeById(tree, selectedNodeId),
    [tree, selectedNodeId]
  )

  const getSiblingIds = useCallback((nodes: StructureTemplate[], parentId: string | null): string[] => {
    if (parentId === null) return nodes.map((node) => node.structure_template_id)
    for (const node of nodes) {
      if (node.structure_template_id === parentId) {
        return (node.children ?? []).map((child) => child.structure_template_id)
      }
      const found = getSiblingIds(node.children ?? [], parentId)
      if (found.length) return found
    }
    return []
  }, [])

  const reorderSiblings = useCallback((siblings: StructureTemplate[], orderedIds: string[]): StructureTemplate[] => {
    if (!siblings.length) return siblings
    const idToNode = new Map(siblings.map((node) => [node.structure_template_id, node]))
    const orderedSet = new Set(orderedIds)
    const next: StructureTemplate[] = []

    for (const id of orderedIds) {
      const node = idToNode.get(id)
      if (node) next.push(node)
    }
    for (const node of siblings) {
      if (!orderedSet.has(node.structure_template_id)) next.push(node)
    }

    const unchanged = next.length === siblings.length && next.every((node, index) => node === siblings[index])
    return unchanged ? siblings : next
  }, [])

  const applySiblingOrder = useCallback((
    nodes: StructureTemplate[],
    parentId: string | null,
    orderedIds: string[]
  ): StructureTemplate[] => {
    if (parentId === null) {
      return reorderSiblings(nodes, orderedIds)
    }

    let changed = false
    const nextNodes = nodes.map((node) => {
      if (node.structure_template_id === parentId) {
        const children = reorderSiblings(node.children ?? [], orderedIds)
        if (children !== (node.children ?? [])) {
          changed = true
          return { ...node, children }
        }
        return node
      }

      if (!node.children?.length) return node

      const nextChildren = applySiblingOrder(node.children, parentId, orderedIds)
      if (nextChildren !== node.children) {
        changed = true
        return { ...node, children: nextChildren }
      }
      return node
    })

    return changed ? nextNodes : nodes
  }, [reorderSiblings])

  const handleSortDrop = useCallback(async (targetId: string, targetParentId: string | null) => {
    const source = sortDraggingRef.current
    sortDraggingRef.current = null
    sortOverRef.current = null
    setSortDragging(null)
    setSortOver(null)

    if (!source) return
    if (source.parentId !== targetParentId) return
    if (source.id === targetId) return

    const current = getSiblingIds(tree, targetParentId)
    if (!current.length) return

    const dragIndex = current.indexOf(source.id)
    const targetIndex = current.indexOf(targetId)
    if (dragIndex < 0 || targetIndex < 0) return

    const next = [...current]
    next.splice(dragIndex, 1)
    const targetIndexAfterRemove = next.indexOf(targetId)
    if (targetIndexAfterRemove < 0) return
    const insertIndex = dragIndex < targetIndex ? targetIndexAfterRemove + 1 : targetIndexAfterRemove
    next.splice(insertIndex, 0, source.id)

    const previousTree = tree
    const optimisticTree = applySiblingOrder(previousTree, targetParentId, next)
    if (optimisticTree !== previousTree) {
      setTree(optimisticTree)
    }

    try {
      await structureTemplateService.reorder(templateId, {
        parent_id: targetParentId,
        ordered_ids: next,
      })
    } catch (err: unknown) {
      setTree(previousTree)
      toastError(err instanceof Error ? err.message : "重排失败")
    }
  }, [applySiblingOrder, getSiblingIds, templateId, tree])

  const variables = coreInfoOptions

  if (loading) {
    return (
      <div className="flex gap-4">
        <div className="h-64 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-64 flex-1 animate-pulse rounded bg-gray-100" />
      </div>
    )
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="flex h-full min-h-0 gap-0 overflow-hidden rounded-lg border border-gray-200">
      <div
        className={cn(
          "flex w-52 shrink-0 flex-col border-r border-gray-200 bg-gray-50",
          stickyOutline && "sticky top-0 self-start h-full"
        )}
      >
        <div className="flex-1 overflow-y-auto py-2">
          {tree.length === 0 && !adding && (
            <p className="py-4 text-center text-xs text-gray-400">暂无章节</p>
          )}
          {tree.map((node) => (
            <TreeItem
              key={node.structure_template_id}
              node={node}
              templateId={templateId}
              depth={0}
              selectedId={selectedNodeId}
              onSelect={(nextNode) => setSelectedNodeId(nextNode.structure_template_id)}
              onCreated={(nodeId) => setSelectedNodeId(nodeId)}
              onReload={() => { void load() }}
              sortDragging={sortDragging}
              sortOver={sortOver}
              onSortDragStart={(id, parentId) => {
                const next = { id, parentId }
                sortDraggingRef.current = next
                sortOverRef.current = null
                setSortDragging(next)
                setSortOver(null)
              }}
              onSortDragEnd={() => {
                sortDraggingRef.current = null
                sortOverRef.current = null
                setSortDragging(null)
                setSortOver(null)
              }}
              onSortDragEnter={(targetId, targetParentId) => {
                const source = sortDraggingRef.current
                if (!source) return
                if (source.parentId !== targetParentId) return
                if (source.id === targetId) return
                const next = { id: targetId, parentId: targetParentId }
                sortOverRef.current = next
                setSortOver(next)
              }}
              onSortDrop={handleSortDrop}
            />
          ))}
          {adding && (
            <AddStructureForm
              templateId={templateId}
              parentId={null}
              parentLevel={0}
              onDone={(newId) => {
                setAdding(false)
                setSelectedNodeId(newId)
                void load()
              }}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={() => setAdding(true)}
            className="h-7 w-full rounded border border-green-400 text-xs font-medium text-green-600 transition hover:bg-green-50"
          >
            + 添加章节
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selectedNode ? (
          <EditPanel
            key={selectedNode.structure_template_id}
            node={selectedNode}
            variables={variables}
            dependencyItem={dependencyMap.get(selectedNode.field_key)}
            onDeleted={() => {
              setSelectedNodeId(null)
              void load()
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            从左侧选择章节进行编辑
          </div>
        )}
      </div>
    </div>
  )
}
