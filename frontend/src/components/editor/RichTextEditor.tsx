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
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { getCoreInfoDragData } from "@/lib/templateDrag"

interface VariableOption {
  fieldKey: string
  label: string
}

interface RichTextEditorProps {
  value?: string
  onChange?: (markdown: string) => void
  onVariableDrop?: (item: VariableOption) => void
  placeholder?: string
  variables?: VariableOption[]
  className?: string
  minHeight?: string
}

function preprocessVariables(markdown: string, variables: VariableOption[]): string {
  const labelMap = Object.fromEntries(variables.map((item) => [item.fieldKey, item.label]))
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
        "h-6 w-6 flex items-center justify-center rounded text-[11px] transition",
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
  onVariableDrop,
  placeholder = "请输入内容...",
  variables = [],
  className,
  minHeight = "120px",
}: RichTextEditorProps) {
  const [dragActive, setDragActive] = useState(false)
  const variableOptions = useMemo(() => {
    const seen = new Set<string>()
    const deduped: VariableOption[] = []
    for (const item of variables) {
      if (seen.has(item.fieldKey)) continue
      seen.add(item.fieldKey)
      deduped.push(item)
    }
    return deduped
  }, [variables])
  const variablesRef = useRef(variables)

  useEffect(() => {
    variablesRef.current = variableOptions
  }, [variableOptions])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ 
        heading: { levels: [1, 2, 3] },
      }),
      Underline, // StarterKit 不包含 Underline，需要单独引入
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
    content: preprocessVariables(value, variableOptions),
    onUpdate: ({ editor }) => {
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

  useEffect(() => {
    if (!editor || editor.isFocused) return
    const processed = preprocessVariables(value, variablesRef.current)
    editor.commands.setContent(processed)
  }, [value, editor])

  const insertVariable = useCallback(
    (fieldKey: string, label: string) => {
      editor?.chain().focus().insertVariable(fieldKey, label).run()
    },
    [editor]
  )

  if (!editor) return null

  return (
    <div
      className={cn(
        "group/editor relative border border-input rounded-md overflow-hidden bg-background transition",
        dragActive && "border-green-400 ring-2 ring-green-100",
        className
      )}
      onDragOver={(event) => {
        const dropped = getCoreInfoDragData(event)
        if (!dropped) return
        event.preventDefault()
        if (!dragActive) setDragActive(true)
      }}
      onDragLeave={() => {
        if (dragActive) setDragActive(false)
      }}
      onDrop={(event) => {
        const dropped = getCoreInfoDragData(event)
        if (!dropped) return
        event.preventDefault()
        setDragActive(false)
        insertVariable(dropped.fieldKey, dropped.label)
        onVariableDrop?.(dropped)
      }}
    >
      {/* 工具栏 */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-0.5 border-b border-input bg-background/95 px-2 py-1 shadow-sm transition",
          "opacity-0 pointer-events-none group-hover/editor:opacity-100 group-hover/editor:pointer-events-auto",
          "group-focus-within/editor:opacity-100 group-focus-within/editor:pointer-events-auto",
        )}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="一级标题"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="二级标题"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="三级标题"
        >
          H3
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

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

      </div>

      {/* 编辑区 */}
      <div className="pt-10">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
