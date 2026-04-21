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
      fieldKey: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-variable") ??
          element.getAttribute("data-field-key") ??
          element.getAttribute("fieldkey"),
      },
      label: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-variable-label") ??
          element.getAttribute("data-label") ??
          element.getAttribute("label"),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const rest = { ...(HTMLAttributes as Record<string, unknown>) }
    delete rest.fieldKey
    delete rest.label
    const fieldKey = String(node.attrs.fieldKey ?? "")
    const label = String(node.attrs.label ?? fieldKey)

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, rest, {
        "data-variable": fieldKey,
        "data-field-key": fieldKey,
        "data-variable-label": label,
        "data-label": label,
        class:
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20 cursor-default select-none mx-0.5",
        contenteditable: "false",
      }),
      [
        "span",
        { class: "hidden" },
        `{{${fieldKey}}}`,
      ],
      [
        "span",
        { class: "font-medium" },
        label,
      ],
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

  // tiptap-markdown 序列化配置
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addStorage(): any {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { fieldKey: string } }) {
          state.write(`{{${node.attrs.fieldKey}}}`)
        },
        parse: {},
      },
    }
  },
})
