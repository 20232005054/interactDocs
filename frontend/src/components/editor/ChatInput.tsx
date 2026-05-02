"use client"

import { useRef, useEffect, useCallback } from "react"

const INPUT_MAX_HEIGHT = 120

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = "auto"
    const nextHeight = Math.min(element.scrollHeight, INPUT_MAX_HEIGHT)
    element.style.height = `${nextHeight}px`
    element.style.overflowY = element.scrollHeight > INPUT_MAX_HEIGHT ? "auto" : "hidden"
  }, [])

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current)
  }, [value, adjustTextareaHeight])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || streaming}
        rows={1}
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-11 text-xs leading-relaxed outline-none transition focus:border-blue-300 focus:bg-white disabled:opacity-50 max-h-[120px] overflow-y-hidden"
        onInput={(event) => adjustTextareaHeight(event.currentTarget)}
      />

      {streaming ? (
        <button
          onClick={onStop}
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-red-100 text-red-500 transition hover:bg-red-200"
          title="停止"
        >
          ■
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 text-white transition hover:bg-blue-600 disabled:opacity-40"
          title="发送"
        >
          ↑
        </button>
      )}
    </div>
  )
}
