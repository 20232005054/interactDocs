"use client"

import { X, ZoomIn, ZoomOut } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { ChapterTreeNode } from "@/types/api"
import MarkdownContent from "@/components/ui/MarkdownContent"

interface ReadingModeViewProps {
  tree: ChapterTreeNode[]
  documentTitle: string
  onClose: () => void
}

// DFS 展开树为有序平铺列表
interface FlatChapter {
  node: ChapterTreeNode
  depth: number
}

function flattenTree(nodes: ChapterTreeNode[], depth = 0): FlatChapter[] {
  const result: FlatChapter[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children.length) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

export default function ReadingModeView({ tree, documentTitle, onClose }: ReadingModeViewProps) {
  const [fontSize, setFontSize] = useState(16) // 基础字号
  const flatList = flattenTree(tree)

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 2, 24))
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 2, 12))

  return (
    <div className="fixed inset-0 bg-[#fafaf9] z-50 flex flex-col animate-in fade-in duration-300">
      {/* 顶部工具栏 */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">{documentTitle}</h1>
        
        <div className="flex items-center gap-3">
          {/* 字号控制 */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1">
            <button
              onClick={decreaseFontSize}
              className="p-1 hover:bg-gray-100 rounded transition"
              title="减小字号"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm text-gray-600 min-w-[3rem] text-center">{fontSize}px</span>
            <button
              onClick={increaseFontSize}
              className="p-1 hover:bg-gray-100 rounded transition"
              title="增大字号"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm text-gray-600"
          >
            <X className="w-4 h-4" />
            <span>退出阅读</span>
          </button>
        </div>
      </div>

      {/* 阅读内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-12 py-12" style={{ fontSize: `${fontSize}px` }}>
          {flatList.map(({ node, depth }) => {
            const sortedParagraphs = [...node.paragraphs].sort((a, b) => a.order_index - b.order_index)
            
            return (
              <div key={node.chapter_id} className="mb-12">
                {/* 章节标题 */}
                <h2
                  className={cn(
                    "font-bold leading-tight mb-6",
                    depth === 0 && "text-3xl text-gray-900 border-b-2 border-gray-200 pb-4",
                    depth === 1 && "text-2xl text-gray-800 border-b border-gray-100 pb-3",
                    depth >= 2 && "text-xl text-gray-700 pb-2",
                  )}
                  style={{ paddingLeft: depth >= 2 ? `${depth * 16}px` : undefined }}
                >
                  {node.title}
                </h2>

                {/* 段落内容 */}
                <div
                  className="space-y-6"
                  style={{ paddingLeft: `${depth * 16}px` }}
                >
                  {sortedParagraphs.map((para) => (
                    <div
                      key={para.paragraph_id}
                      className={cn(
                        "leading-relaxed",
                        para.para_type === "heading1" && "text-2xl font-semibold text-gray-900 mt-8 mb-4",
                        para.para_type === "heading2" && "text-xl font-medium text-gray-800 mt-6 mb-3",
                        para.para_type === "heading3" && "text-lg font-medium text-gray-700 mt-4 mb-2",
                        para.para_type === "paragraph" && "text-gray-700 leading-loose",
                      )}
                    >
                      <MarkdownContent content={para.content} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="h-10 shrink-0 bg-white border-t border-gray-200 flex items-center justify-center text-xs text-gray-500">
        按 Esc 或点击右上角退出阅读模式 · 快捷键：Ctrl+Shift+R
      </div>
    </div>
  )
}
