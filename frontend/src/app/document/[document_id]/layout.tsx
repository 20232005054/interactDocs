"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChapterTree } from "@/components/document/ChapterTree";
import { AIAssistantPanel } from "@/components/chat/AIAssistantPanel";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { useAIStore } from "@/store/aiStore";
import {
  FileText,
  KeyRound,
  AlignLeft,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const documentId = params.document_id as string;

  const { activeDocument, toc, setActiveDocument, setToc } = useDocumentStore();
  const { selectedText } = useEditorStore();
  const { setSelectedContext } = useAIStore();

  useEffect(() => {
    // 加载文档数据
    const loadDocument = async () => {
      try {
        const response = await fetch(`/api/v1/documents/${documentId}`);
        if (response.ok) {
          const data = await response.json();
          setActiveDocument(data);
          setToc(data.chapters || []);
        } else {
          // 使用模拟数据
          setActiveDocument({
            id: documentId,
            title: "示例文档",
            purpose: "测试",
            template: "default",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setToc([
            { id: "1", documentId, title: "第一章：引言", order: 1 },
            { id: "2", documentId, title: "第二章：背景", order: 2 },
            { id: "3", documentId, title: "第三章：方法", order: 3 },
          ]);
        }
      } catch (error) {
        console.error("加载文档失败:", error);
      }
    };

    loadDocument();
  }, [documentId, setActiveDocument, setToc]);

  // 监听选中的文本，更新 AI 上下文
  useEffect(() => {
    if (selectedText) {
      setSelectedContext({
        type: "text",
        content: selectedText,
      });
    }
  }, [selectedText, setSelectedContext]);

  const navItems = [
    {
      href: `/document/${documentId}`,
      label: "基本信息",
      icon: Settings,
      exact: true,
    },
    {
      href: `/document/${documentId}/keyword`,
      label: "关键词",
      icon: KeyRound,
    },
    {
      href: `/document/${documentId}/summary`,
      label: "摘要",
      icon: AlignLeft,
    },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b bg-card h-14 flex items-center px-4 shrink-0">
        <Link href="/documents">
          <Button variant="ghost" size="sm" className="mr-4">
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">
            {activeDocument?.title || "加载中..."}
          </h1>
        </div>
      </header>

      {/* 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航栏 */}
        <div className="w-[250px] border-r bg-card flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="py-4">
              <div className="px-4 mb-2 text-xs font-medium text-muted-foreground uppercase">
                文档管理
              </div>
              <nav className="space-y-1 px-2">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                        isActive(item.href, item.exact)
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                  </Link>
                ))}
              </nav>

              <div className="mt-6">
                <ChapterTree
                  documentId={documentId}
                  chapters={toc}
                  activeChapterId={pathname.split("/").pop()}
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* 中间内容区 */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* 右侧 AI 助手 */}
        <AIAssistantPanel
          onApplySuggestion={(content) => {
            // 这里可以通过全局状态通知编辑器更新内容
            console.log("应用 AI 建议:", content);
          }}
          className="w-[350px] shrink-0"
        />
      </div>
    </div>
  );
}
