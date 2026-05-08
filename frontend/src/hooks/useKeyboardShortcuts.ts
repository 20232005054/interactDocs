import { useEffect } from "react"

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl
        const shiftMatch = shortcut.shift === undefined || event.shiftKey === shortcut.shift
        const altMatch = shortcut.alt === undefined || event.altKey === shortcut.alt
        const metaMatch = shortcut.meta === undefined || event.metaKey === shortcut.meta

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }
          shortcut.action()
          break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts, enabled])
}

// 预定义的快捷键配置
export const EDITOR_SHORTCUTS = {
  SAVE: { key: "s", ctrl: true, description: "保存文档" },
  FIND: { key: "f", ctrl: true, description: "查找" },
  TOGGLE_SIDEBAR_LEFT: { key: "b", ctrl: true, shift: true, description: "切换左侧栏" },
  TOGGLE_SIDEBAR_RIGHT: { key: "i", ctrl: true, shift: true, description: "切换右侧栏" },
  FOCUS_SEARCH: { key: "/", ctrl: true, description: "聚焦搜索" },
  NEW_PARAGRAPH: { key: "Enter", ctrl: true, description: "新建段落" },
  DELETE_PARAGRAPH: { key: "Backspace", ctrl: true, shift: true, description: "删除当前段落" },
  TOGGLE_READING_MODE: { key: "r", ctrl: true, shift: true, description: "切换阅读模式" },
  OPEN_AI_CHAT: { key: "k", ctrl: true, description: "打开 AI 对话" },
  WORD_COUNT: { key: "w", ctrl: true, shift: true, description: "显示字数统计" },
}
