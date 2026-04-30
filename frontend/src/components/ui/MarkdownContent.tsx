"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // 段落
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        
        // 标题
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
        
        // 列表
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="ml-2">{children}</li>,
        
        // 代码
        code: ({ inline, children, ...props }: any) => {
          if (inline) {
            return (
              <code className="px-1 py-0.5 rounded bg-gray-200 text-gray-800 text-[11px] font-mono" {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="block px-2 py-1.5 rounded bg-gray-200 text-gray-800 text-[11px] font-mono overflow-x-auto mb-2" {...props}>
              {children}
            </code>
          )
        },
        
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-300 pl-2 italic text-gray-600 mb-2">
            {children}
          </blockquote>
        ),
        
        // 链接
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">
            {children}
          </a>
        ),
        
        // 强调
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        
        // 分隔线
        hr: () => <hr className="my-2 border-gray-300" />,
        
        // 表格
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full border-collapse border border-gray-300 text-xs">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-gray-300">{children}</tr>,
        th: ({ children }) => <th className="border border-gray-300 px-2 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
