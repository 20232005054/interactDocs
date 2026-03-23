"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChapterTree } from "@/components/document/ChapterTree";
import { AIAssistantPanel } from "@/components/chat/AIAssistantPanel";
import { type Chapter, useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { useAIStore } from "@/store/aiStore";
import {
  FileText,
  KeyRound,
  AlignLeft,
  Settings,
  ChevronLeft,
  Clock3,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentDetailResponse {
  document_id: string;
  title: string;
  purpose: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChapterResponseItem {
  chapter_id: string;
  document_id: string;
  title: string;
  status: number;
  order_index: number;
  updated_at: string;
}

const mockSnapshots = [
  { id: "snapshot-1", name: "Version 1", time: "2026-03-20 14:30" },
  { id: "snapshot-2", name: "Version 2", time: "2026-03-22 09:10" },
];

const mockRelations = [
  { id: "relation-1", name: "Summary Rules", type: "Template" },
  { id: "relation-2", name: "Keyword Set A", type: "Keyword" },
];

function mapChapter(item: ChapterResponseItem): Chapter {
  return {
    id: item.chapter_id,
    documentId: item.document_id,
    title: item.title,
    order: item.order_index,
  };
}

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

  const [isLoading, setIsLoading] = useState(true);

  const loadDocument = useCallback(async () => {
    const response = await fetch(`/api/v1/documents/${documentId}`);
    if (!response.ok) {
      throw new Error("加载文档失败");
    }

    const result = await response.json();
    const data: DocumentDetailResponse = result.data;

    setActiveDocument({
      id: data.document_id,
      title: data.title,
      purpose: data.purpose,
      template: data.template_id || "",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }, [documentId, setActiveDocument]);

  const loadChapters = useCallback(async () => {
    const response = await fetch(`/api/v1/documents/documents/${documentId}/chapters`);
    if (!response.ok) {
      throw new Error("加载章节失败");
    }

    const result = await response.json();
    const chapters: ChapterResponseItem[] = result.data?.chapters || [];
    setToc(chapters.map(mapChapter));
  }, [documentId, setToc]);

  useEffect(() => {
    const loadSidebarData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadDocument(), loadChapters()]);
      } catch (error) {
        console.error("加载文档侧边栏失败:", error);
        setActiveDocument(null);
        setToc([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSidebarData();
  }, [loadChapters, loadDocument, setActiveDocument, setToc]);

  useEffect(() => {
    if (selectedText) {
      setSelectedContext({
        type: "text",
        content: selectedText,
      });
    }
  }, [selectedText, setSelectedContext]);

  const handleAddChapter = async () => {
    try {
      const response = await fetch(`/api/v1/chapters/${documentId}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("新增章节失败");
      }

      await loadChapters();
    } catch (error) {
      console.error("新增章节失败:", error);
    }
  };

  const handleRenameChapter = async (chapterId: string, title: string) => {
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error("更新章节失败");
      }

      await loadChapters();
    } catch (error) {
      console.error("更新章节失败:", error);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    const confirmed = window.confirm("确定要删除这个章节吗？");
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除章节失败");
      }

      await loadChapters();
    } catch (error) {
      console.error("删除章节失败:", error);
    }
  };

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
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center border-b bg-card px-4">
        <Link href="/documents">
          <Button variant="ghost" size="sm" className="mr-4">
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">
            {isLoading ? "加载中..." : activeDocument?.title || "未命名文档"}
          </h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[300px] shrink-0 flex-col border-r bg-card">
          <ScrollArea className="flex-1">
            <div className="py-4">
              <div className="mb-2 px-4 text-xs font-medium uppercase text-muted-foreground">
                文档管理
              </div>
              <nav className="space-y-1 px-2">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
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
                  onAddChapter={handleAddChapter}
                  onRenameChapter={handleRenameChapter}
                  onDeleteChapter={handleDeleteChapter}
                />
              </div>

              <div className="mt-6 space-y-4 px-3">
                <section className="rounded-lg border bg-background">
                  <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    快照信息
                  </div>
                  <div className="space-y-2 p-3">
                    {mockSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="rounded-md bg-muted px-3 py-2 text-xs"
                      >
                        <div className="font-medium">{snapshot.name}</div>
                        <div className="mt-1 text-muted-foreground">
                          {snapshot.time}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-background">
                  <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    关联信息
                  </div>
                  <div className="space-y-2 p-3">
                    {mockRelations.map((relation) => (
                      <div
                        key={relation.id}
                        className="rounded-md bg-muted px-3 py-2 text-xs"
                      >
                        <div className="font-medium">{relation.name}</div>
                        <div className="mt-1 text-muted-foreground">
                          {relation.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-hidden">{children}</div>

        <AIAssistantPanel
          onApplySuggestion={(content) => {
            console.log("应用 AI 建议:", content);
          }}
          className="w-[350px] shrink-0"
        />
      </div>
    </div>
  );
}
