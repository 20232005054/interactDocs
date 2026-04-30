"use client"

import { useEffect, useState, useCallback } from "react"
import { ChevronDown, ChevronRight, BookOpen, FileText, Bookmark } from "lucide-react"
import { documentService } from "@/services/documentService"
import { templateService } from "@/services/templateService"
import { useDocumentStore } from "@/store/documentStore"
import { cn } from "@/lib/utils"
import { toastError } from "@/hooks/useToast"
import type {
  DocumentCitationItem,
  ParagraphLiteratureItem,
  Literature,
} from "@/types/api"

interface LiteratureManagementPanelProps {
  documentId: string
  templateId: string | null
}

export default function LiteratureManagementPanel({
  documentId,
  templateId,
}: LiteratureManagementPanelProps) {
  const [loading, setLoading] = useState(true)
  const [citations, setCitations] = useState<DocumentCitationItem[]>([])
  const [paragraphLiterature, setParagraphLiterature] = useState<ParagraphLiteratureItem[]>([])
  const [templateLiterature, setTemplateLiterature] = useState<Literature[]>([])

  const [citationsExpanded, setCitationsExpanded] = useState(true)
  const [paragraphExpanded, setParagraphExpanded] = useState(true)
  const [templateExpanded, setTemplateExpanded] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [citationsRes, paragraphRes, templateRes] = await Promise.all([
        documentService.getCitations(documentId),
        documentService.getParagraphLiterature(documentId),
        templateId ? templateService.getLiterature(templateId) : Promise.resolve({ items: [], total: 0 }),
      ])
      setCitations(citationsRes.citations)
      setParagraphLiterature(paragraphRes.items)
      setTemplateLiterature(templateRes.items)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [documentId, templateId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs text-gray-400">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto compact-scrollbar">
      <div className="px-6 py-6 space-y-6">
        {/* 文档引用文献 */}
        <section>
          <button
            type="button"
            onClick={() => setCitationsExpanded(!citationsExpanded)}
            className="w-full flex items-center gap-2 mb-3 group"
          >
            {citationsExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            )}
            <BookOpen className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-700">
              文档引用文献 ({citations.length})
            </h3>
          </button>

          {citationsExpanded && (
            <div className="ml-6 space-y-3">
              {citations.length === 0 ? (
                <p className="text-xs text-gray-400">暂无引用文献</p>
              ) : (
                citations.map((citation) => (
                  <div
                    key={citation.literature_id}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                        [{citation.citation_number}]
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">
                          {citation.title || "无标题"}
                        </h4>
                        {citation.authors && (
                          <p className="text-xs text-gray-500 mb-0.5">
                            作者：{citation.authors}
                          </p>
                        )}
                        {citation.journal && (
                          <p className="text-xs text-gray-500 mb-0.5">
                            期刊：{citation.journal}
                          </p>
                        )}
                        {citation.doi && (
                          <p className="text-xs text-gray-400 font-mono">
                            DOI: {citation.doi}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* 段落文献绑定 */}
        <section>
          <button
            type="button"
            onClick={() => setParagraphExpanded(!paragraphExpanded)}
            className="w-full flex items-center gap-2 mb-3 group"
          >
            {paragraphExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            )}
            <FileText className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-medium text-gray-700">
              段落文献绑定 ({paragraphLiterature.length})
            </h3>
          </button>

          {paragraphExpanded && (
            <div className="ml-6 space-y-4">
              {paragraphLiterature.length === 0 ? (
                <p className="text-xs text-gray-400">暂无段落文献绑定</p>
              ) : (
                <ParagraphLiteratureList items={paragraphLiterature} />
              )}
            </div>
          )}
        </section>

        {/* 模板文献库 */}
        <section>
          <button
            type="button"
            onClick={() => setTemplateExpanded(!templateExpanded)}
            className="w-full flex items-center gap-2 mb-3 group"
          >
            {templateExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            )}
            <Bookmark className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-700">
              模板文献库 ({templateLiterature.length})
            </h3>
          </button>

          {templateExpanded && (
            <div className="ml-6 space-y-3">
              {templateLiterature.length === 0 ? (
                <p className="text-xs text-gray-400">模板未绑定文献</p>
              ) : (
                templateLiterature.map((lit) => (
                  <div
                    key={lit.literature_id}
                    className="p-3 rounded-lg border border-gray-200 bg-amber-50 hover:bg-amber-100 transition"
                  >
                    <h4 className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">
                      {lit.title || "无标题"}
                    </h4>
                    {lit.authors && (
                      <p className="text-xs text-gray-500 mb-0.5">
                        作者：{lit.authors}
                      </p>
                    )}
                    {lit.journal && (
                      <p className="text-xs text-gray-500 mb-0.5">
                        期刊：{lit.journal}
                      </p>
                    )}
                    {lit.doi && (
                      <p className="text-xs text-gray-400 font-mono">
                        DOI: {lit.doi}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        lit.scope === "public"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      )}>
                        {lit.scope === "public" ? "公共文献" : "私有文献"}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        lit.upload_status === "ready"
                          ? "bg-green-100 text-green-600"
                          : lit.upload_status === "processing"
                            ? "bg-yellow-100 text-yellow-600"
                            : lit.upload_status === "failed"
                              ? "bg-red-100 text-red-600"
                              : "bg-gray-100 text-gray-600"
                      )}>
                        {lit.upload_status === "ready" ? "就绪" :
                          lit.upload_status === "processing" ? "处理中" :
                            lit.upload_status === "failed" ? "失败" : "待处理"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// 段落文献列表（按章节分组）
// ----------------------------------------------------------------
interface ParagraphLiteratureListProps {
  items: ParagraphLiteratureItem[]
}

function ParagraphLiteratureList({ items }: ParagraphLiteratureListProps) {
  // 按章节分组
  const groupedByChapter = items.reduce((acc, item) => {
    if (!acc[item.chapter_id]) {
      acc[item.chapter_id] = {
        chapter_title: item.chapter_title,
        items: [],
      }
    }
    acc[item.chapter_id].items.push(item)
    return acc
  }, {} as Record<string, { chapter_title: string; items: ParagraphLiteratureItem[] }>)

  return (
    <div className="space-y-4">
      {Object.entries(groupedByChapter).map(([chapterId, group]) => (
        <div key={chapterId} className="space-y-2">
          <h4 className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-gray-400" />
            {group.chapter_title}
          </h4>
          <div className="ml-3 space-y-2">
            {group.items.map((item) => (
              <div
                key={`${item.paragraph_id}-${item.literature_id}`}
                className="p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
              >
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {item.paragraph_content}
                </p>
                <div className="flex items-start gap-2 pl-3 border-l-2 border-green-200">
                  <BookOpen className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 line-clamp-1">
                      {item.literature_title || "无标题"}
                    </p>
                    {item.literature_authors && (
                      <p className="text-xs text-gray-400 line-clamp-1">
                        {item.literature_authors}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
