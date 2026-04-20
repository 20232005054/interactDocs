"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { structureTemplateService, coreInfoTemplateService, summaryTemplateService } from "@/services/templateService"
import type {
  StructureTemplate, StructureTemplateParagraphDef,
  CoreInfoTemplate, SummaryTemplate,
  SourceInfo, GenerationMode, ParaType,
} from "@/types/api"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { cn } from "@/lib/utils"

interface StructureTemplateStepProps {
  templateId: string
  onCountChange?: (count: number) => void
}

interface VariableOption {
  fieldKey: string
  label: string
}

const SOURCE_TYPE_OPTIONS = [
  { value: "keyinfo", label: "核心信息" },
  { value: "summary", label: "摘要" },
  { value: "chapter", label: "章节" },
]

const MATCH_TYPE_OPTIONS = [
  { value: "keyinfo_match", label: "核心信息匹配" },
  { value: "summary_match", label: "摘要匹配" },
  { value: "chapter_match", label: "章节匹配" },
]

const PARA_TYPE_OPTIONS: { value: ParaType; label: string }[] = [
  { value: "paragraph", label: "正文" },
  { value: "heading1", label: "一级标题" },
  { value: "heading2", label: "二级标题" },
  { value: "heading3", label: "三级标题" },
]

const GENERATION_MODE_OPTIONS = [
  { value: 0, label: "复制", hint: "变量替换模板内容" },
  { value: 1, label: "AI生成", hint: "AI 根据来源数据生成" },
  { value: 2, label: "直接使用", hint: "固定内容，不受变更影响" },
  { value: 3, label: "AI修改", hint: "AI 润色模板草稿" },
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

function countTree(nodes: StructureTemplate[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countTree(n.children ?? []), 0)
}

function makeEmptyParaDef(): StructureTemplateParagraphDef {
  return {
    para_type: "paragraph",
    content_template: "",
    generation_mode: 2,
    sources: null,
    default_prompt: null,
    custom_prompt: null,
  }
}

// ----------------------------------------------------------------
// 匹配字段下拉
// ----------------------------------------------------------------
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
      <button type="button" onClick={() => setOpen(v => !v)}
        className="h-6 px-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded">
        ▾
      </button>
      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-md min-w-36 py-1 max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.fieldKey} type="button" onClick={() => onToggle(opt)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2">
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
// 来源行
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
  const matchKeyOptions =
    sourceType === "keyinfo" ? coreInfoOptions :
    sourceType === "summary" ? summaryOptions :
    structureOptions
  const selectedKeys = source.match_keys.map(k => k.value)

  return (
    <div className="flex items-start gap-2">
      <span className="mt-2 text-gray-300 cursor-grab select-none text-base">≡</span>
      <select
        value={sourceType}
        onChange={e => onChange({
          ...source,
          source: { value: e.target.value, label: SOURCE_TYPE_OPTIONS.find(o => o.value === e.target.value)?.label ?? e.target.value },
          match_keys: [],
        })}
        className="h-9 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 transition w-28"
      >
        {SOURCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={source.match_type}
        onChange={e => onChange({ ...source, match_type: e.target.value })}
        className="h-9 rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-400 transition w-36"
      >
        {MATCH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="flex-1 min-h-9 rounded border border-gray-300 bg-white px-2 py-1 flex flex-wrap gap-1 items-center">
        {source.match_keys.map(k => (
          <span key={k.value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
            {k.label}
            <button type="button" onClick={() => onChange({ ...source, match_keys: source.match_keys.filter(mk => mk.value !== k.value) })}
              className="hover:text-red-500 leading-none">×</button>
          </span>
        ))}
        <MatchKeyDropdown
          options={matchKeyOptions}
          selectedKeys={selectedKeys}
          onToggle={opt => {
            const exists = selectedKeys.includes(opt.fieldKey)
            const newKeys = exists
              ? source.match_keys.filter(k => k.value !== opt.fieldKey)
              : [...source.match_keys, { value: opt.fieldKey, label: opt.label }]
            onChange({ ...source, match_keys: newKeys })
          }}
        />
      </div>
      <button type="button" onClick={onRemove} className="mt-2 text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
    </div>
  )
}

// ----------------------------------------------------------------
// 单个段落定义行
// ----------------------------------------------------------------
interface ParaDefRowProps {
  paraDef: StructureTemplateParagraphDef
  index: number
  coreInfoOptions: VariableOption[]
  summaryOptions: VariableOption[]
  structureOptions: VariableOption[]
  variables: VariableOption[]
  onChange: (updated: StructureTemplateParagraphDef) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

function ParaDefRow({
  paraDef, index,
  coreInfoOptions, summaryOptions, structureOptions, variables,
  onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: ParaDefRowProps) {
  const mode = paraDef.generation_mode
  const sources = paraDef.sources ?? []

  const updateSources = (next: SourceInfo[]) => onChange({ ...paraDef, sources: next.length ? next : null })

  return (
    <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 bg-white">
      {/* 行头：序号 + 类型 + 生成方式 + 排序 + 删除 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 w-5 shrink-0">#{index + 1}</span>

        {/* 段落类型 */}
        <select
          value={paraDef.para_type}
          onChange={e => onChange({ ...paraDef, para_type: e.target.value as ParaType })}
          className="h-7 rounded border border-gray-300 bg-white px-2 text-xs outline-none focus:border-green-400 transition w-24"
        >
          {PARA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* 生成方式 */}
        <select
          value={mode}
          onChange={e => onChange({ ...paraDef, generation_mode: Number(e.target.value) as GenerationMode })}
          className="h-7 rounded border border-gray-300 bg-white px-2 text-xs outline-none focus:border-green-400 transition w-24"
        >
          {GENERATION_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <span className="text-xs text-gray-400 flex-1">
          {GENERATION_MODE_OPTIONS.find(o => o.value === mode)?.hint}
        </span>

        {/* 排序按钮 */}
        <button type="button" onClick={onMoveUp} disabled={isFirst}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-30 text-sm px-1">↑</button>
        <button type="button" onClick={onMoveDown} disabled={isLast}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-30 text-sm px-1">↓</button>

        {/* 删除 */}
        <button type="button" onClick={onRemove}
          className="text-gray-300 hover:text-red-400 text-sm px-1">×</button>
      </div>

      {/* 来源配置（mode≠2 时显示） */}
      {mode !== 2 && (
        <div className="flex flex-col gap-2 pl-5">
          <span className="text-xs text-gray-500">来源：</span>
          {sources.map((src, i) => (
            <SourceRow
              key={i}
              source={src}
              coreInfoOptions={coreInfoOptions}
              summaryOptions={summaryOptions}
              structureOptions={structureOptions}
              onChange={updated => updateSources(sources.map((s, idx) => idx === i ? updated : s))}
              onRemove={() => updateSources(sources.filter((_, idx) => idx !== i))}
            />
          ))}
          <button type="button"
            onClick={() => updateSources([...sources, { source: { value: "keyinfo", label: "核心信息" }, match_type: "keyinfo_match", match_keys: [] }])}
            className="self-start text-xs text-green-600 hover:text-green-700 font-medium">
            + 添加来源
          </button>
        </div>
      )}

      {/* 内容模板（mode≠1 时显示） */}
      {mode !== 1 && (
        <div className="pl-5">
          <RichTextEditor
            value={paraDef.content_template ?? ""}
            onChange={v => onChange({ ...paraDef, content_template: v })}
            variables={mode === 0 ? variables : []}
            placeholder={
              mode === 2 ? "直接使用：输入固定内容..." :
              mode === 3 ? "AI修改草稿：输入初始内容，AI 将润色..." :
              "复制模式：可插入 {{变量}} 占位符..."
            }
            minHeight="80px"
          />
        </div>
      )}

      {/* 提示词（mode=1/3 时显示） */}
      {(mode === 1 || mode === 3) && (
        <div className="pl-5 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">默认提示词：</span>
            <textarea
              value={paraDef.default_prompt ?? ""}
              onChange={e => onChange({ ...paraDef, default_prompt: e.target.value || null })}
              rows={4}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs outline-none focus:border-green-400 resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">自定义提示词：</span>
            <textarea
              value={paraDef.custom_prompt ?? ""}
              onChange={e => onChange({ ...paraDef, custom_prompt: e.target.value || null })}
              rows={4}
              className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-green-400 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// 右侧编辑面板（章节标题 + 段落定义列表）
// ----------------------------------------------------------------
interface EditPanelProps {
  node: StructureTemplate
  coreInfoOptions: VariableOption[]
  summaryOptions: VariableOption[]
  structureOptions: VariableOption[]
  variables: VariableOption[]
  onDeleted: () => void
}

function EditPanel({ node, coreInfoOptions, summaryOptions, structureOptions, variables, onDeleted }: EditPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [paraDefs, setParaDefs] = useState<StructureTemplateParagraphDef[]>(node.paragraphs ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 切换节点时重置
  useEffect(() => {
    setTitle(node.title)
    setParaDefs(node.paragraphs ?? [])
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

  const handleParaDefsChange = (next: StructureTemplateParagraphDef[]) => {
    setParaDefs(next)
    save({ paragraphs: next })
  }

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
      {/* 标题行 + 删除 */}
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

      {/* 章节标题 */}
      <div className="flex items-center gap-3">
        <label className="w-20 text-sm text-gray-600 shrink-0">章节标题：</label>
        <input
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); save({ title: e.target.value }) }}
          placeholder="请输入"
          className="w-48 h-8 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400 transition"
        />
      </div>

      {/* 段落定义列表 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">段落定义：</label>
          <span className="text-xs text-gray-400">{paraDefs.length} 个段落</span>
        </div>

        {paraDefs.length === 0 && (
          <p className="text-xs text-gray-400 py-2 pl-1">暂无段落定义，点击下方添加</p>
        )}

        {paraDefs.map((paraDef, idx) => (
          <ParaDefRow
            key={idx}
            paraDef={paraDef}
            index={idx}
            coreInfoOptions={coreInfoOptions}
            summaryOptions={summaryOptions}
            structureOptions={structureOptions}
            variables={variables}
            isFirst={idx === 0}
            isLast={idx === paraDefs.length - 1}
            onChange={updated => handleParaDefsChange(paraDefs.map((p, i) => i === idx ? updated : p))}
            onRemove={() => handleParaDefsChange(paraDefs.filter((_, i) => i !== idx))}
            onMoveUp={() => {
              if (idx === 0) return
              const next = [...paraDefs]
              ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
              handleParaDefsChange(next)
            }}
            onMoveDown={() => {
              if (idx === paraDefs.length - 1) return
              const next = [...paraDefs]
              ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
              handleParaDefsChange(next)
            }}
          />
        ))}

        <button
          type="button"
          onClick={() => handleParaDefsChange([...paraDefs, makeEmptyParaDef()])}
          className="self-start h-7 px-3 rounded border border-green-400 text-green-600 text-xs font-medium hover:bg-green-50 transition"
        >
          + 添加段落定义
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 左侧章节树节点
// ----------------------------------------------------------------
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
        className={cn(
          "w-full text-left py-2 pr-3 text-sm transition rounded-sm",
          isSelected ? "bg-green-500 text-white font-medium" : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <span>{node.title}</span>
        {node.paragraphs && node.paragraphs.length > 0 && (
          <span className={cn("ml-1.5 text-xs", isSelected ? "text-green-100" : "text-gray-400")}>
            {node.paragraphs.length}段
          </span>
        )}
      </button>
      {node.children?.map(child => (
        <TreeItem key={child.structure_template_id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// 新建章节表单
// ----------------------------------------------------------------
function AddStructureForm({ templateId, parentId, parentLevel, onDone, onCancel }: {
  templateId: string
  parentId: string | null
  parentLevel: number
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
      await structureTemplateService.create({
        template_id: templateId,
        parent_id: parentId,
        title: title.trim(),
        level: parentLevel + 1,
        paragraphs: [],
      })
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 border border-dashed border-green-300 rounded bg-green-50 mx-2 mt-1">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="章节标题"
        className="flex-1 h-7 rounded border border-gray-300 px-2 text-sm outline-none focus:border-green-400"
      />
      <button type="submit" disabled={loading || !title.trim()}
        className="h-7 px-2 rounded bg-green-500 text-white text-xs hover:bg-green-600 disabled:opacity-50 transition">
        {loading ? "..." : "创建"}
      </button>
      <button type="button" onClick={onCancel}
        className="h-7 px-2 rounded border border-gray-300 text-xs text-gray-500 hover:bg-gray-50 transition">
        取消
      </button>
    </form>
  )
}

// ----------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------
export default function StructureTemplateStep({ templateId, onCountChange }: StructureTemplateStepProps) {
  const [tree, setTree] = useState<StructureTemplate[]>([])
  const [selectedNode, setSelectedNode] = useState<StructureTemplate | null>(null)
  const [coreInfoOptions, setCoreInfoOptions] = useState<VariableOption[]>([])
  const [summaryOptions, setSummaryOptions] = useState<VariableOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [structureRes, coreRes, summaryRes] = await Promise.all([
        structureTemplateService.getByTemplate(templateId),
        coreInfoTemplateService.getByTemplate(templateId),
        summaryTemplateService.getByTemplate(templateId),
      ])
      const newTree = structureRes.tree ?? []
      setTree(newTree)
      setCoreInfoOptions(flattenCoreInfo(coreRes.items ?? []))
      setSummaryOptions((summaryRes.items ?? []).map((s: SummaryTemplate) => ({ fieldKey: s.field_key, label: s.title })))
      onCountChange?.(countTree(newTree))

      if (selectedNode) {
        const findNode = (nodes: StructureTemplate[]): StructureTemplate | null => {
          for (const n of nodes) {
            if (n.structure_template_id === selectedNode.structure_template_id) return n
            const found = findNode(n.children ?? [])
            if (found) return found
          }
          return null
        }
        const updated = findNode(newTree)
        if (updated) setSelectedNode(updated)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [templateId, onCountChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const structureOptions = flattenStructure(tree)
  const variables = coreInfoOptions

  if (loading) return (
    <div className="flex gap-4">
      <div className="w-44 h-64 bg-gray-100 rounded animate-pulse" />
      <div className="flex-1 h-64 bg-gray-100 rounded animate-pulse" />
    </div>
  )

  if (error) return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="flex gap-0 min-h-96 border border-gray-200 rounded-lg overflow-hidden">
      {/* 左侧章节树 */}
      <div className="w-44 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto py-2">
          {tree.length === 0 && !adding && (
            <p className="text-xs text-gray-400 text-center py-4">暂无章节</p>
          )}
          {tree.map(node => (
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
              onDone={() => { setAdding(false); load() }}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setAdding(true)}
            className="w-full h-7 rounded border border-green-400 text-green-600 text-xs font-medium hover:bg-green-50 transition"
          >
            + 添加章节
          </button>
        </div>
      </div>

      {/* 右侧编辑面板 */}
      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <EditPanel
            key={selectedNode.structure_template_id}
            node={selectedNode}
            coreInfoOptions={coreInfoOptions}
            summaryOptions={summaryOptions}
            structureOptions={structureOptions}
            variables={variables}
            onDeleted={() => { setSelectedNode(null); load() }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            从左侧选择章节进行编辑
          </div>
        )}
      </div>
    </div>
  )
}
