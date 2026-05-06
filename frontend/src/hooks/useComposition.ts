import { useState, useCallback } from "react"

/**
 * 处理中文输入法组合事件的 Hook
 * 
 * 使用示例：
 * ```tsx
 * const { isComposing, compositionHandlers } = useComposition()
 * 
 * <input
 *   value={value}
 *   onChange={(e) => {
 *     if (!isComposing) {
 *       setValue(e.target.value)
 *     }
 *   }}
 *   {...compositionHandlers((e) => setValue(e.target.value))}
 * />
 * ```
 */
export function useComposition() {
  const [isComposing, setIsComposing] = useState(false)

  const compositionHandlers = useCallback(
    (onCompositionEnd?: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void) => ({
      onCompositionStart: () => setIsComposing(true),
      onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setIsComposing(false)
        onCompositionEnd?.(e)
      },
    }),
    []
  )

  return { isComposing, compositionHandlers }
}
