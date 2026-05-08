"use client"

import { useEffect, useImperativeHandle, forwardRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Markdown } from "tiptap-markdown"
import { Bold, Italic, Underline as UnderlineIcon, Code, List, ListOrdered, Copy, Wand2, MessageSquare } from "lucide-react"
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
  onAIRewrite?: (selectedText: string) => void
  onAddToContext?: (selectedText: string) => void
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
        "h-7 min-w-7 px-2 rounded-md text-xs font-medium transition-all duration-200",
        active
          ? "bg-blue-500 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      {children}
    </button>
  )
}

const ParagraphEditor = forwardRef<ParagraphEditorHandle, ParagraphEditorProps>(
  function ParagraphEditor(
    { paragraphId, content, paraType, isChanged, onChange, onEnterAtEnd, onBackspaceAtStart, onFocus, onAIRewrite, onAddToContext },
    ref
  ) {
    const headingLevel = HEADING_LEVEL[paraType]
    const [selectedText, setSelectedText] = useState("")

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // 禁用 StarterKit 内置的 heading，统一由 paraType 控制
          heading: headingLevel ? { levels: [1, 2, 3] } : false,
        }),
        Underline, // StarterKit 不包含 Underline，需要单独引入
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
      onSelectionUpdate({ editor: e }) {
        // 更新选中文本
        const { from, to, empty } = e.state.selection
        if (!empty) {
          const text = e.state.doc.textBetween(from, to, " ")
          setSelectedText(text)
        } else {
          setSelectedText("")
        }
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

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(selectedText)
      } catch (err) {
        console.error("复制失败:", err)
      }
    }

    const handleAIRewrite = () => {
      if (selectedText && onAIRewrite) {
        onAIRewrite(selectedText)
      }
    }

    const handleAddToContext = () => {
      if (selectedText && onAddToContext) {
        onAddToContext(selectedText)
      }
    }

    return (
      <div
        className={cn(
          "w-full relative paragraph-editor",
          isChanged && "border-l-2 border-orange-400 pl-2",
          paraType === "heading1" && "[&_.tiptap]:text-3xl [&_.tiptap]:font-bold [&_.tiptap]:text-gray-900 [&_.tiptap]:leading-tight",
          paraType === "heading2" && "[&_.tiptap]:text-2xl [&_.tiptap]:font-semibold [&_.tiptap]:text-gray-800 [&_.tiptap]:leading-tight",
          paraType === "heading3" && "[&_.tiptap]:text-xl [&_.tiptap]:font-medium [&_.tiptap]:text-gray-700 [&_.tiptap]:leading-tight",
          paraType === "paragraph" && "[&_.tiptap]:text-base [&_.tiptap]:text-gray-700 [&_.tiptap]:leading-8 [&_.tiptap]:tracking-wide",
        )}
      >
        {editor && !editor.state.selection.empty && (
          <div className="absolute -top-12 left-0 z-50 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white shadow-xl px-2 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* 格式化按钮 */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="加粗 (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="斜体 (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive("underline")}
              title="下划线 (Ctrl+U)"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive("code")}
              title="行内代码"
            >
              <Code className="w-3.5 h-3.5" />
            </ToolbarButton>
            
            <div className="w-px h-4 bg-gray-200 mx-1" />
            
            {/* 列表按钮 */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="无序列表"
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="有序列表"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarButton>
            
            <div className="w-px h-4 bg-gray-200 mx-1" />
            
            {/* 操作按钮 */}
            <ToolbarButton
              onClick={handleCopy}
              title="复制"
            >
              <Copy className="w-3.5 h-3.5" />
            </ToolbarButton>
            
            {onAIRewrite && (
              <ToolbarButton
                onClick={handleAIRewrite}
                title="AI 改写选中文本"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </ToolbarButton>
            )}
            
            {onAddToContext && (
              <ToolbarButton
                onClick={handleAddToContext}
                title="添加到对话上下文"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </ToolbarButton>
            )}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    )
  }
)

export default ParagraphEditor
