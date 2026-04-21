"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { structureTemplateService, coreInfoTemplateService } from "@/services/templateService"
import type { StructureTemplate, CoreInfoTemplate, SourceInfo, GenerationMode, StructureDependencyItem } from "@/types/api"
import RichTextEditor from "@/components/editor/RichTextEditor"
import ReadonlySourceList from "@/components/template/ReadonlySourceList"
import {
  appendVariableText,
  getCoreInfoDragData,
  upsertCoreInfoSource,
} from "@/lib/templateDrag"

interface StructureTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
  dependencyItems?: StructureDependencyItem[]
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
  const walk = (list: CoreInfoTemplate[]) => {
    for (const node of list) {
      if (node.field_type !== "group") {
        result.push({ fieldKey: node.field_key, label: node.field_name })
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

interface EditPanelProps {
  node: StructureTemplate
  variables: VariableOption[]
  onDeleted: () => void
  dependencyItem?: StructureDependencyItem
}

function EditPanel({ node, variables, onDeleted, dependencyItem }: EditPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [generationMode, setGenerationMode] = useState<GenerationMode>(node.generation_mode)
  const [sources, setSources] = useState<SourceInfo[]>(node.sources ?? [])
  const [contentTemplate, setContentTemplate] = useState(node.content_template ?? "")
  const [defaultPrompt, setDefaultPrompt] = useState(node.default_prompt ?? "")
  const [customPrompt, setCustomPrompt] = useState(node.custom_prompt ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTitle(node.title)
    setGenerationMode(node.generation_mode)
    setSources(node.sources ?? [])
    setContentTemplate(node.content_template ?? "")
    setDefaultPrompt(node.default_prompt ?? "")
    setCustomPrompt(node.custom_prompt ?? "")
  }, [node.structure_template_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((patch: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await structureTemplateService.update(node.structure_template_id, patch)
      } finally {
        setSaving(false)
      }
    }, 600)
  }, [node.structure_template_id])

  const handleSourcesChange = useCallback((next: SourceInfo[]) => {
    setSources(next)
    save({ sources: next })
  }, [save])

  const syncDroppedSource = useCallback((dropped: { fieldKey: string; label: string }) => {
    handleSourcesChange(upsertCoreInfoSource(sources, dropped))
  }, [handleSourcesChange, sources])

  const handleDelete = async () => {
    try {
      await structureTemplateService.delete(node.structure_template_id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const showSources = generationMode !== 2
  const showPrompts = generationMode === 1 || generationMode === 3

  return (
    <div className="flex flex-col gap-4 p-5">
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
            <button onClick={() => setDeleting(true)} className="text-xs text-gray-400 hover:text-red-400">删除</button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-600">章节标题：</label>
        <input
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            save({ title: event.target.value })
          }}
          placeholder="请输入"
          className="h-8 w-48 rounded border border-gray-300 px-2 text-sm outline-none transition focus:border-green-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-600">生成方式</label>
        <select
          value={generationMode}
          onChange={(event) => {
            const value = Number(event.target.value) as GenerationMode
            setGenerationMode(value)
            save({ generation_mode: value })
          }}
          className="h-8 w-28 rounded border border-gray-300 bg-white px-2 text-sm outline-none transition focus:border-green-400"
        >
          {GENERATION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <div className="flex flex-wrap items-start gap-2">
          <span className="shrink-0 text-gray-500">引用来源:</span>
          {dependencyItem?.references?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {dependencyItem.references.slice(0, 5).map((ref) => (
                <span
                  key={`struct-ref-${node.field_key}-${ref.type}-${ref.field_key}`}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700"
                  title={`${ref.type}/${ref.field_key}`}
                >
                  {ref.label || ref.field_key}
                </span>
              ))}
              {dependencyItem.references.length > 5 && (
                <span className="text-gray-400">{`+${dependencyItem.references.length - 5}`}</span>
              )}
            </div>
          ) : (
            <span>暂无</span>
          )}
        </div>
      </div>

      {showSources ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600">来源方式：</label>
          <ReadonlySourceList sources={sources} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-500">
          当前为“直接使用”模式，内容模板会原样写入章节正文，不使用来源映射和变量替换。
        </div>
      )}

      <RichTextEditor
        value={contentTemplate}
        onChange={(value) => {
          setContentTemplate(value)
          save({ content_template: value })
        }}
        onVariableDrop={syncDroppedSource}
        variables={variables}
        placeholder="这里是一大段模板文字，可插入 {{变量}} 占位符..."
        minHeight="120px"
      />
      <p className="text-xs text-gray-400">
        {generationMode === 2
          ? "当前模式会直接使用这里的原文内容。"
          : generationMode === 3
            ? "这里的内容会作为草稿交给 AI 修改，支持拖入变量占位符。"
            : "支持将核心信息字段拖入编辑区，自动插入变量占位符。"}
      </p>

      {showPrompts && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>AI提示词：</span>
            <button type="button" className="text-sm text-green-600 hover:underline">引用样例库</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">默认提示词：</span>
              <textarea
                value={defaultPrompt}
                onChange={(event) => {
                  setDefaultPrompt(event.target.value)
                  save({ default_prompt: event.target.value })
                }}
                onDragOver={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                  const next = appendVariableText(defaultPrompt, dropped)
                  setDefaultPrompt(next)
                  save({ default_prompt: next })
                  syncDroppedSource(dropped)
                }}
                rows={6}
                className="resize-none rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">自定义提示词：</span>
              <textarea
                value={customPrompt}
                onChange={(event) => {
                  setCustomPrompt(event.target.value)
                  save({ custom_prompt: event.target.value })
                }}
                onDragOver={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  const dropped = getCoreInfoDragData(event)
                  if (!dropped) return
                  event.preventDefault()
                  const next = appendVariableText(customPrompt, dropped)
                  setCustomPrompt(next)
                  save({ custom_prompt: next })
                  syncDroppedSource(dropped)
                }}
                rows={6}
                className="resize-none rounded border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TreeItemProps {
  node: StructureTemplate
  depth: number
  selectedId: string | null
  onSelect: (node: StructureTemplate) => void
}

function TreeItem({ node, depth, selectedId, onSelect }: TreeItemProps) {
  const isSelected = node.structure_template_id === selectedId
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        className={
          isSelected
            ? "w-full rounded-sm bg-green-500 py-2 pr-3 text-left text-sm font-medium text-white transition"
            : "w-full rounded-sm py-2 pr-3 text-left text-sm text-gray-700 transition hover:bg-gray-100"
        }
      >
        {node.title}
      </button>
      {node.children?.map((child) => (
        <TreeItem
          key={child.structure_template_id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function AddStructureForm({ templateId, parentId, parentLevel, onDone, onCancel }: {
  templateId: string
  parentId: string | null
  parentLevel: number
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
      await structureTemplateService.create({
        template_id: templateId,
        parent_id: parentId,
        title: title.trim(),
        level: parentLevel + 1,
      })
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-2 mt-1 flex items-center gap-2 rounded border border-dashed border-green-300 bg-green-50 p-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
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
}: StructureTemplateStepProps) {
  const [tree, setTree] = useState<StructureTemplate[]>([])
  const [selectedNode, setSelectedNode] = useState<StructureTemplate | null>(null)
  const [coreInfoOptions, setCoreInfoOptions] = useState<VariableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
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

      if (selectedNode) {
        const findNode = (nodes: StructureTemplate[]): StructureTemplate | null => {
          for (const currentNode of nodes) {
            if (currentNode.structure_template_id === selectedNode.structure_template_id) return currentNode
            const found = findNode(currentNode.children ?? [])
            if (found) return found
          }
          return null
        }
        const updatedNode = findNode(nextTree)
        if (updatedNode) setSelectedNode(updatedNode)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

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
    <div className="flex min-h-96 gap-0 overflow-hidden rounded-lg border border-gray-200">
      <div className="flex w-44 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex-1 overflow-y-auto py-2">
          {tree.length === 0 && !adding && (
            <p className="py-4 text-center text-xs text-gray-400">暂无章节</p>
          )}
          {tree.map((node) => (
            <TreeItem
              key={node.structure_template_id}
              node={node}
              depth={0}
              selectedId={selectedNode?.structure_template_id ?? null}
              onSelect={setSelectedNode}
            />
          ))}
          {adding && (
            <AddStructureForm
              templateId={templateId}
              parentId={null}
              parentLevel={0}
              onDone={() => {
                setAdding(false)
                load()
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

      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <EditPanel
            key={selectedNode.structure_template_id}
            node={selectedNode}
            variables={variables}
            dependencyItem={dependencyMap.get(selectedNode.field_key)}
            onDeleted={() => {
              setSelectedNode(null)
              load()
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
