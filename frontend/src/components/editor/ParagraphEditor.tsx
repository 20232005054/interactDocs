"use client"

import { useEffect, useImperativeHandle, forwardRef, useState, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Markdown } from "tiptap-markdown"
import { cn } from "@/lib/utils"
import type { ParaType } from "@/types/api"

export interface ParagraphEditorHandle {
  focus: () => void
  focusEnd: () => void
}

interface ParagraphEditorProps {
  paragraphId: string
  content: string
  paraType: ParaType
  isChanged?: boolean
  onChange: (markdown: string) => void
  onEnterAtEnd?: () => void
  onBackspaceAtStart?: () => void
  onFocus?: () => void
}

// paraType → Tiptap heading level（paragraph 不需要）
const HEADING_LEVEL: Partial<Record<ParaType, 1 | 2 | 3>> = {
  heading1: 1,
  heading2: 2,
  heading3: 3,
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        "h-6 min-w-6 px-1.5 rounded text-xs font-medium transition",
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  )
}

const ParagraphEditor = forwardRef<ParagraphEditorHandle, ParagraphEditorProps>(
  function ParagraphEditor(
    { paragraphId, content, paraType, isChanged, onChange, onEnterAtEnd, onBackspaceAtStart, onFocus },
    ref
  ) {
    const headingLevel = HEADING_LEVEL[paraType]

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // 禁用 StarterKit 内置的 heading，统一由 paraType 控制
          heading: headingLevel ? { levels: [1, 2, 3] } : false,
        }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
        Markdown.configure({
          html: false,
          tightLists: true,
          breaks: true,
          transformPastedText: true,
        }),
      ],
      content: content,
      editorProps: {
        attributes: {
          class: "outline-none min-h-[1.5em] leading-relaxed",
          "data-paragraph-id": paragraphId,
        },
        handleKeyDown(view, event) {
          // Enter 在末尾：触发新建段落
          if (event.key === "Enter" && !event.shiftKey) {
            const { state } = view
            const { selection, doc } = state
            const isAtEnd = selection.$to.pos === doc.content.size - 1
            if (isAtEnd && onEnterAtEnd) {
              event.preventDefault()
              onEnterAtEnd()
              return true
            }
          }
          // Backspace 在开头且内容为空：触发删除段落
          if (event.key === "Backspace") {
            const { state } = view
            const { selection } = state
            const isEmpty = state.doc.textContent.trim() === ""
            const isAtStart = selection.$from.pos <= 1
            if ((isEmpty || isAtStart) && onBackspaceAtStart) {
              event.preventDefault()
              onBackspaceAtStart()
              return true
            }
          }
          return false
        },
      },
      onUpdate({ editor: e }) {
        const md = e.storage.markdown.getMarkdown()
        onChange(md)
      },
      onFocus() {
        onFocus?.()
      },
      immediatelyRender: false,
    })

    // 同步外部内容变更（AI 应用后 store 更新）
    useEffect(() => {
      if (!editor) return
      const current = editor.storage.markdown.getMarkdown()
      if (current !== content) {
        editor.commands.setContent(content, false)
      }
    }, [content, editor])

    // 同步 paraType 变更
    useEffect(() => {
      if (!editor) return
      if (headingLevel) {
        editor.commands.setHeading({ level: headingLevel })
      } else {
        editor.commands.setParagraph()
      }
    }, [paraType, headingLevel, editor])

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus("start"),
      focusEnd: () => editor?.commands.focus("end"),
    }))

    return (
      <div
        className={cn(
          "w-full relative",
          isChanged && "border-l-2 border-orange-400 pl-2",
          paraType === "heading1" && "[&_.tiptap]:text-xl [&_.tiptap]:font-bold [&_.tiptap]:text-gray-900",
          paraType === "heading2" && "[&_.tiptap]:text-lg [&_.tiptap]:font-semibold [&_.tiptap]:text-gray-800",
          paraType === "heading3" && "[&_.tiptap]:text-base [&_.tiptap]:font-medium [&_.tiptap]:text-gray-700",
          paraType === "paragraph" && "[&_.tiptap]:text-sm [&_.tiptap]:text-gray-700",
        )}
      >
        {editor && !editor.state.selection.empty && (
          <div className="absolute -top-8 left-0 z-50 flex items-center gap-0.5 rounded-md border border-gray-200 bg-white shadow-md px-1 py-0.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="加粗 (Ctrl+B)"
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="斜体 (Ctrl+I)"
            >
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive("code")}
              title="行内代码"
            >
              <span className="font-mono text-xs">`</span>
            </ToolbarButton>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
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
              1.
            </ToolbarButton>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    )
  }
)

export default ParagraphEditor
