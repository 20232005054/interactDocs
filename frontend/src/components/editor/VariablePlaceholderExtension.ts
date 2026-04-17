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
 * - 渲染为带样式的 inline chip，显示 label（面向用户）
 * - 序列化为 Markdown 时输出 {{field_key}}（面向后端）
 * - 从 Markdown 解析时把 {{field_key}} 还原为 chip 节点
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
          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20 cursor-default select-none mx-0.5",
        contenteditable: "false",
      }),
      // 显示 label，不显示 key
      HTMLAttributes.label ?? `{{${HTMLAttributes.fieldKey}}}`,
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

  // 序列化为纯文本时输出 {{field_key}}（后端替换依赖此格式）
  renderText({ node }) {
    return `{{${node.attrs.fieldKey}}}`
  },

  // tiptap-markdown 序列化配置
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addStorage(): any {
    return {
      markdown: {
        // chip → {{field_key}}
        serialize(_state: unknown, node: { attrs: { fieldKey: string } }) {
          return `{{${node.attrs.fieldKey}}}`
        },
        // {{field_key}} → chip 节点（在 parseMarkdown 阶段由 inputRule 处理）
        parse: {},
      },
    }
  },
})
