import { Node, mergeAttributes } from "@tiptap/core"

export interface VariablePlaceholderOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variablePlaceholder: {
      insertVariable: (fieldKey: string, label: string) => ReturnType
    }
  }
}

/**
 * 挖空节点：在富文本中插入 {{field_key}} 变量占位符
 * 渲染为带样式的 inline chip，序列化为 {{field_key}}
 */
export const VariablePlaceholderExtension = Node.create<VariablePlaceholderOptions>({
  name: "variablePlaceholder",
  group: "inline",
  inline: true,
  atom: true, // 不可编辑内部，整体选中删除

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      fieldKey: { default: null },
      label: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-variable": HTMLAttributes.fieldKey,
        class:
          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20 cursor-default select-none mx-0.5",
        contenteditable: "false",
      }),
      `{{${HTMLAttributes.fieldKey}}}`,
    ]
  },

  addCommands() {
    return {
      insertVariable:
        (fieldKey: string, label: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { fieldKey, label },
          })
        },
    }
  },

  // 序列化为纯文本时输出 {{field_key}}
  renderText({ node }) {
    return `{{${node.attrs.fieldKey}}}`
  },
})
