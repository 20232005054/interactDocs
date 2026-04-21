import type { DragEvent } from "react"
import type { SourceInfo, SourceMatchKey } from "@/types/api"

export interface CoreInfoDragItem {
  fieldKey: string
  label: string
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
    return { fieldKey: parsed.fieldKey, label: parsed.label }
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
  return {
    ...source,
    source: { value: "keyinfo", label: "核心信息", ui_type: "select" },
    match_type: "keyinfo_match",
    match_keys: appendSourceMatchKey(source.match_keys, item),
    target_field: source.target_field || item.fieldKey,
  }
}

export function createCoreInfoSource(item: CoreInfoDragItem): SourceInfo {
  return {
    source: { value: "keyinfo", label: "核心信息", ui_type: "select" },
    match_type: "keyinfo_match",
    match_keys: [{ value: item.fieldKey, label: item.label, ui_type: "select" }],
    target_field: item.fieldKey,
  }
}
