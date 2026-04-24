import type { DragEvent } from "react"
import type { SourceInfo, SourceMatchKey } from "@/types/api"

export interface CoreInfoDragItem {
  fieldKey: string
  label: string
  isGroup?: boolean
  groupChildren?: Array<{ value: string; label: string }>
}

const CORE_INFO_DRAG_MIME = "application/x-interactivedocs-core-info"

export function buildVariablePlaceholder(item: CoreInfoDragItem): string {
  return `{{${item.fieldKey}}}`
}

export function setCoreInfoDragData(event: DragEvent<HTMLElement>, item: CoreInfoDragItem) {
  const payload = JSON.stringify(item)
  event.dataTransfer.effectAllowed = "copy"
  event.dataTransfer.setData(CORE_INFO_DRAG_MIME, payload)
  event.dataTransfer.setData("text/plain", buildVariablePlaceholder(item))
}

export function getCoreInfoDragData(event: Pick<DragEvent<HTMLElement>, "dataTransfer">): CoreInfoDragItem | null {
  const raw = event.dataTransfer.getData(CORE_INFO_DRAG_MIME)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<CoreInfoDragItem>
    if (!parsed.fieldKey || !parsed.label) return null
    return {
      fieldKey: parsed.fieldKey,
      label: parsed.label,
      isGroup: parsed.isGroup === true,
      groupChildren: Array.isArray(parsed.groupChildren)
        ? parsed.groupChildren
          .filter((item): item is { value: string; label: string } => (
            typeof item?.value === "string" && typeof item?.label === "string"
          ))
        : undefined,
    }
  } catch {
    return null
  }
}

export function appendVariableText(value: string, item: CoreInfoDragItem): string {
  const token = buildVariablePlaceholder(item)
  if (!value.trim()) return token
  const suffix = value.endsWith("\n") ? "" : "\n"
  return `${value}${suffix}${token}`
}

export function appendSourceMatchKey(matchKeys: SourceMatchKey[], item: CoreInfoDragItem): SourceMatchKey[] {
  if (matchKeys.some((key) => key.value === item.fieldKey)) {
    return matchKeys
  }

  return [...matchKeys, { value: item.fieldKey, label: item.label, ui_type: "select" }]
}

export function applyCoreInfoToSource(source: SourceInfo, item: CoreInfoDragItem): SourceInfo {
  if (item.isGroup) {
    return {
      ...source,
      source: { value: "keyinfo_group", label: `核心信息分组：${item.label}`, ui_type: "select" },
      match_type: "keyinfo_group_match",
      match_keys: (item.groupChildren ?? []).map((child) => ({
        value: child.value,
        label: child.label,
        ui_type: "select",
      })),
      target_field: item.fieldKey,
    }
  }

  return {
    ...source,
    source: { value: "keyinfo", label: "核心信息", ui_type: "select" },
    match_type: "keyinfo_match",
    match_keys: appendSourceMatchKey(source.match_keys, item),
    target_field: source.target_field || item.fieldKey,
  }
}

export function createCoreInfoSource(item: CoreInfoDragItem): SourceInfo {
  if (item.isGroup) {
    return {
      source: { value: "keyinfo_group", label: `核心信息分组：${item.label}`, ui_type: "select" },
      match_type: "keyinfo_group_match",
      match_keys: (item.groupChildren ?? []).map((child) => ({
        value: child.value,
        label: child.label,
        ui_type: "select",
      })),
      target_field: item.fieldKey,
    }
  }

  return {
    source: { value: "keyinfo", label: "核心信息", ui_type: "select" },
    match_type: "keyinfo_match",
    match_keys: [{ value: item.fieldKey, label: item.label, ui_type: "select" }],
    target_field: item.fieldKey,
  }
}

export function upsertCoreInfoSource(sources: SourceInfo[], item: CoreInfoDragItem): SourceInfo[] {
  if (item.isGroup) {
    const existingGroupIndex = sources.findIndex((source) =>
      source.match_type === "keyinfo_group_match" && source.target_field === item.fieldKey
    )

    if (existingGroupIndex >= 0) {
      return sources.map((source, index) =>
        index === existingGroupIndex ? applyCoreInfoToSource(source, item) : source
      )
    }

    return [...sources, createCoreInfoSource(item)]
  }

  const existingIndex = sources.findIndex((source) => {
    if (source.match_type === "keyinfo_group_match") return false
    if (source.target_field === item.fieldKey) return true
    return source.match_keys.some((key) => key.value === item.fieldKey)
  })

  if (existingIndex >= 0) {
    return sources.map((source, index) =>
      index === existingIndex ? applyCoreInfoToSource(source, item) : source
    )
  }

  const emptyKeyinfoIndex = sources.findIndex(
    (source) =>
      source.source.value === "keyinfo" &&
      !source.target_field &&
      source.match_keys.length === 0
  )

  if (emptyKeyinfoIndex >= 0) {
    return sources.map((source, index) =>
      index === emptyKeyinfoIndex ? applyCoreInfoToSource(source, item) : source
    )
  }

  return [...sources, createCoreInfoSource(item)]
}

export function collectVariableKeys(values: Array<string | null | undefined>): Set<string> {
  const keys = new Set<string>()
  const pattern = /\{\{([a-zA-Z0-9_]+)\}\}/g

  for (const value of values) {
    if (!value) continue
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(value)) !== null) {
      if (match[1]) keys.add(match[1])
    }
  }

  return keys
}

export function pruneCoreInfoSourcesByKeys(
  sources: SourceInfo[],
  keys: Set<string>,
  labelMap: Record<string, string> = {}
): SourceInfo[] {
  return sources.flatMap((source) => {
    if (source.match_type === "keyinfo_group_match") {
      const groupKey = source.target_field
      if (!groupKey || !keys.has(groupKey)) return []
      return [source]
    }

    if (source.source.value !== "keyinfo") return [source]

    const matchKeys = Array.isArray(source.match_keys) ? source.match_keys : []
    const filtered = matchKeys.filter((item) => keys.has(item.value))
    const targetField = source.target_field
    const targetStillUsed = !!targetField && keys.has(targetField)

    if (!filtered.length && !targetStillUsed) {
      return []
    }

    if (targetStillUsed && targetField && !filtered.some((item) => item.value === targetField)) {
      filtered.unshift({
        value: targetField,
        label: labelMap[targetField] ?? targetField,
        ui_type: "select",
      })
    }

    const nextTarget = targetStillUsed
      ? targetField
      : (filtered[0]?.value ?? "")

    return [{
      ...source,
      match_keys: filtered,
      target_field: nextTarget,
    }]
  })
}
