"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Markdown } from "tiptap-markdown"
import { VariablePlaceholderExtension } from "./VariablePlaceholderExtension"
import { cn } from "@/lib/utils"
import { useState, useCallback, useEffect, useRef } from "react"

interface VariableOption {
  fieldKey: string
  label: string
}

interface RichTextEditorProps {
  value?: string
  onChange?: (markdown: string) => void
  placeholder?: string
  variables?: VariableOption[]
  className?: string
  minHeight?: string
}

// 把 Markdown 中的 {{field_key}} 预处理为 chip 节点可识别的格式
// tiptap-markdown 先把 MD 转为 HTML，再由 Tiptap 解析 HTML
// 所以在 MD → HTML 阶段，把 {{key}} 转成 <span data-variable="key" label="..."> 让 parseHTML 规则接管
function preprocessVariables(
  markdown: string,
  variables: VariableOption[]
): string {
  const labelMap = Object.fromEntries(variables.map((v) => [v.fieldKey, v.label]))
  return markdown.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const label = labelMap[key] ?? key
    return `<span data-variable="${key}" fieldKey="${key}" label="${label}"></span>`
  })
}

// 工具栏按钮
function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-sm transition",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "请输入内容...",
  variables = [],
  className,
  minHeight = "120px",
}: RichTextEditorProps) {
  const [showVarPicker, setShowVarPicker] = useState(false)
  const variablesRef = useRef(variables)
  variablesRef.current = variables

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      VariablePlaceholderExtension,
    ],
    // 初始内容：先预处理 {{}} 为 span，再让 Markdown 扩展解析
    content: preprocessVariables(value, variables),
    onUpdate: ({ editor }) => {
      // 序列化为 Markdown 输出（chip 通过 renderText 输出 {{field_key}}）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = ((editor.storage as any).markdown as import("tiptap-markdown").MarkdownStorage).getMarkdown()
      onChange?.(md)
    },
    editorProps: {
      attributes: {
        class: "outline-none prose prose-sm max-w-none px-3 py-2",
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // value 外部变化时同步（仅在编辑器未聚焦时更新，避免光标跳动）
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const processed = preprocessVariables(value, variablesRef.current)
    editor.commands.setContent(processed)
  }, [value, editor])

  const insertVariable = useCallback(
    (fieldKey: string, label: string) => {
      editor?.chain().focus().insertVariable(fieldKey, label).run()
      setShowVarPicker(false)
    },
    [editor]
  )

  if (!editor) return null

  return (
    <div className={cn("border border-input rounded-md overflow-hidden bg-background", className)}>
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-input bg-muted/30 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="加粗"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="斜体"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="下划线"
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="无序列表"
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="有序列表"
        >
          ①
        </ToolbarButton>

        {/* 变量插入（仅当有变量可选时显示） */}
        {variables.length > 0 && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setShowVarPicker((v) => !v)
                }}
                className={cn(
                  "h-7 px-2 flex items-center gap-1 rounded text-xs font-medium transition",
                  showVarPicker
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="插入变量占位符"
              >
                <span>{"{ }"}</span>
                <span>插入变量</span>
              </button>

              {showVarPicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-md min-w-36 py-1">
                  {variables.map((v) => (
                    <button
                      key={v.fieldKey}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertVariable(v.fieldKey, v.label)
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition"
                    >
                      {/* 只显示 label，不显示 key */}
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 编辑区 */}
      <EditorContent editor={editor} />
    </div>
  )
}
