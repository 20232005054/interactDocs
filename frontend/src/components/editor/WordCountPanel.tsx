"use client"

import { useMemo } from "react"
import { FileText, Hash, AlignLeft, Heading } from "lucide-react"
import type { ChapterTreeNode } from "@/types/api"

interface WordCountPanelProps {
  tree: ChapterTreeNode[]
  visible: boolean
  onClose: () => void
}

interface WordCountStats {
  totalChars: number
  totalWords: number
  totalParagraphs: number
  totalHeadings: number
  chapterStats: Array<{
    chapterId: string
    title: string
    chars: number
    words: number
    paragraphs: number
  }>
}

function countWords(text: string): number {
  // 移除 Markdown 标记
  const cleanText = text
    .replace(/[#*_`~\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  
  // 中文字符数 + 英文单词数
  const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = cleanText
    .replace(/[\u4e00-\u9fa5]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 0).length
  
  return chineseChars + englishWords
}

function calculateStats(tree: ChapterTreeNode[]): WordCountStats {
  let totalChars = 0
  let totalWords = 0
  let totalParagraphs = 0
  let totalHeadings = 0
  const chapterStats: WordCountStats["chapterStats"] = []

  function processChapter(chapter: ChapterTreeNode) {
    let chapterChars = 0
    let chapterWords = 0
    let chapterParagraphs = 0

    for (const para of chapter.paragraphs) {
      const content = para.content || ""
      const chars = content.length
      const words = countWords(content)

      chapterChars += chars
      chapterWords += words
      totalChars += chars
      totalWords += words

      if (para.para_type === "paragraph") {
        chapterParagraphs++
        totalParagraphs++
      } else {
        totalHeadings++
      }
    }

    chapterStats.push({
      chapterId: chapter.chapter_id,
      title: chapter.title,
      chars: chapterChars,
      words: chapterWords,
      paragraphs: chapterParagraphs,
    })

    // 递归处理子章节
    for (const child of chapter.children) {
      processChapter(child)
    }
  }

  for (const chapter of tree) {
    processChapter(chapter)
  }

  return {
    totalChars,
    totalWords,
    totalParagraphs,
    totalHeadings,
    chapterStats,
  }
}

export default function WordCountPanel({ tree, visible, onClose }: WordCountPanelProps) {
  const stats = useMemo(() => calculateStats(tree), [tree])

  if (!visible) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 面板 */}
      <div className="fixed right-4 top-20 bottom-4 w-96 bg-white rounded-lg shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">字数统计</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 总体统计 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Hash className="w-4 h-4" />
                <span className="text-sm font-medium">总字数</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{stats.totalWords.toLocaleString()}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">总字符</span>
              </div>
              <div className="text-2xl font-bold text-green-700">{stats.totalChars.toLocaleString()}</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <AlignLeft className="w-4 h-4" />
                <span className="text-sm font-medium">段落数</span>
              </div>
              <div className="text-2xl font-bold text-purple-700">{stats.totalParagraphs}</div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <Heading className="w-4 h-4" />
                <span className="text-sm font-medium">标题数</span>
              </div>
              <div className="text-2xl font-bold text-amber-700">{stats.totalHeadings}</div>
            </div>
          </div>

          {/* 章节统计 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">各章节统计</h3>
            <div className="space-y-2">
              {stats.chapterStats.map((chapter) => (
                <div
                  key={chapter.chapterId}
                  className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition"
                >
                  <div className="font-medium text-gray-900 text-sm mb-2 truncate">
                    {chapter.title}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{chapter.words} 字</span>
                    <span>·</span>
                    <span>{chapter.chars} 字符</span>
                    <span>·</span>
                    <span>{chapter.paragraphs} 段落</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 rounded-b-lg">
          快捷键：Ctrl+Shift+W
        </div>
      </div>
    </>
  )
}
