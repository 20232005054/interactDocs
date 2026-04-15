"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { VariablePlaceholderExtension } from "./VariablePlaceholderExtension"
import { cn } from "@/lib/utils"
import { useState, useCallback } from "react"
import { getCoreInfoDragData } from "@/lib/templateDrag"

interface VariableOption {
  fieldKey: string
  label: string
}

interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  variables?: VariableOption[]
  className?: string
  minHeight?: string
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
  const [dragActive, setDragActive] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      VariablePlaceholderExtension,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "outline-none prose prose-sm max-w-none px-3 py-2",
        style: `min-height: ${minHeight}`,
      },
    },
  })

  const insertVariable = useCallback(
    (fieldKey: string, label: string) => {
      editor?.chain().focus().insertVariable(fieldKey, label).run()
      setShowVarPicker(false)
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
      }}
    >
      {/* 工具栏 */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-0.5 border-b border-input bg-background/95 px-3 py-2 shadow-sm transition",
          "opacity-0 pointer-events-none group-hover/editor:opacity-100 group-hover/editor:pointer-events-auto",
          "group-focus-within/editor:opacity-100 group-focus-within/editor:pointer-events-auto",
          showVarPicker && "opacity-100 pointer-events-auto"
        )}
      >
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

        {/* 挖空变量插入（仅当有变量可选时显示） */}
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
                <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-md shadow-md min-w-40 py-1">
                  {variables.map((v) => (
                    <button
                      key={v.fieldKey}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertVariable(v.fieldKey, v.label)
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition flex items-center gap-2"
                    >
                      <span className="text-xs font-mono text-primary">{`{{${v.fieldKey}}}`}</span>
                      <span className="text-muted-foreground">{v.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 编辑区 */}
      <div className="pt-14">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
