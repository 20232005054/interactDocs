"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { ContentHeader } from "@/components/document/ContentHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";

interface SummaryResponseItem {
  summary_id: string;
  document_id: string;
  title: string | null;
  content: string | null;
  version: number;
  order_index: number;
  ai_generate?: string | null;
}

interface SummaryItem {
  id: string;
  documentId: string;
  title: string;
  content: string;
  version: number;
  orderIndex: number;
  aiGenerate: string;
}

function mapSummary(item: SummaryResponseItem): SummaryItem {
  return {
    id: item.summary_id,
    documentId: item.document_id,
    title: item.title || "",
    content: item.content || "",
    version: item.version,
    orderIndex: item.order_index,
    aiGenerate: item.ai_generate || "",
  };
}

function sortSummaries(items: SummaryItem[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

export default function SummaryPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const { setActiveContext } = useEditorStore();

  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssisting, setIsAssisting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.id === selectedSummaryId) ?? null,
    [selectedSummaryId, summaries]
  );

  useEffect(() => {
    setActiveContext("summary");
  }, [setActiveContext]);

  useEffect(() => {
    const loadSummaries = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/v1/documents/${documentId}/summaries`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.message || "加载摘要失败");
        }

        const items: SummaryResponseItem[] = Array.isArray(result?.data?.summaries)
          ? result.data.summaries
          : [];
        const mapped = sortSummaries(items.map(mapSummary));
        setSummaries(mapped);
        setSelectedSummaryId(mapped[0]?.id ?? null);
      } catch (error) {
        console.error("加载摘要失败", error);
        setSummaries([]);
        setSelectedSummaryId(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSummaries();
  }, [documentId]);

  useEffect(() => {
    if (!selectedSummaryId) {
      setTitle("");
      setContent("");
      return;
    }

    const current = summaries.find((item) => item.id === selectedSummaryId);

    if (!current) {
      setSelectedSummaryId(summaries[0]?.id ?? null);
      return;
    }

    setTitle(current.title);
    setContent(current.content);
  }, [selectedSummaryId, summaries]);

  const replaceSummary = (item: SummaryItem) => {
    setSummaries((current) => sortSummaries(current.map((summary) => (summary.id === item.id ? item : summary))));
  };

  const handleCreateSummary = async () => {
    setIsCreating(true);

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "创建摘要失败");
      }

      const created = mapSummary(result.data);
      setSummaries((current) => sortSummaries([...current, created]));
      setSelectedSummaryId(created.id);
    } catch (error) {
      console.error("创建摘要失败", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSummaryId) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/summaries/${selectedSummaryId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "保存摘要失败");
      }

      replaceSummary(mapSummary(result.data));
    } catch (error) {
      console.error("保存摘要失败", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSummaryId) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/summaries/${selectedSummaryId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "删除摘要失败");
      }

      setSummaries((current) => {
        const next = current.filter((item) => item.id !== selectedSummaryId);
        setSelectedSummaryId(next[0]?.id ?? null);
        return next;
      });
    } catch (error) {
      console.error("删除摘要失败", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInsertAfter = async () => {
    if (!selectedSummaryId) {
      return;
    }

    setIsInserting(true);

    try {
      const response = await fetch(`/api/v1/summaries/${selectedSummaryId}/insert-after`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "插入摘要失败");
      }

      const created = mapSummary(result.data);
      setSummaries((current) => sortSummaries([...current, created]));
      setSelectedSummaryId(created.id);
    } catch (error) {
      console.error("插入摘要失败", error);
    } finally {
      setIsInserting(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries/ai/generate`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "AI 生成摘要失败");
      }

      const items: SummaryResponseItem[] = Array.isArray(result?.data?.summaries)
        ? result.data.summaries
        : [];
      const mapped = sortSummaries(items.map(mapSummary));
      setSummaries(mapped);
      setSelectedSummaryId(mapped[0]?.id ?? null);
    } catch (error) {
      console.error("AI 生成摘要失败", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssist = async () => {
    if (!selectedSummaryId) {
      return;
    }

    setIsAssisting(true);

    try {
      const response = await fetch(`/api/v1/summaries/${selectedSummaryId}/ai/assist`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "AI 帮填摘要失败");
      }

      replaceSummary(mapSummary(result.data));
    } catch (error) {
      console.error("AI 帮填摘要失败", error);
    } finally {
      setIsAssisting(false);
    }
  };

  const handleApplyAI = async () => {
    if (!selectedSummaryId) {
      return;
    }

    setIsApplying(true);

    try {
      const response = await fetch(`/api/v1/summaries/${selectedSummaryId}/ai/apply`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "应用 AI 结果失败");
      }

      replaceSummary(mapSummary(result.data));
    } catch (error) {
      console.error("应用 AI 结果失败", error);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ContentHeader
        title="摘要管理"
        onSave={handleSave}
        onAIAssist={handleGenerateAll}
        isSaving={isSaving || isGenerating}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r bg-card">
          <div className="border-b p-4">
            <Button className="w-full" onClick={handleCreateSummary} disabled={isCreating}>
              <Plus className="mr-1 h-4 w-4" />
              {isCreating ? "创建中..." : "新增摘要"}
            </Button>
          </div>

          <ScrollArea className="h-[calc(100%-73px)]">
            <div className="p-2">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">加载中...</div>
              ) : summaries.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">暂无摘要</div>
              ) : (
                summaries.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedSummaryId(item.id)}
                    className={cn(
                      "mb-2 w-full rounded-lg border p-3 text-left transition-colors",
                      selectedSummaryId === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div className="text-sm font-medium">
                      {item.title || `摘要 ${index + 1}`}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.content || "暂无内容"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {selectedSummary ? (
            <div className="mx-auto max-w-4xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>摘要内容</CardTitle>
                  <CardDescription>支持编辑标题和正文，并调用 AI 补全当前摘要。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">摘要标题</label>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="请输入摘要标题"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">摘要正文</label>
                    <Textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="请输入摘要内容"
                      rows={12}
                      className="resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleAssist} disabled={isAssisting}>
                      <Sparkles className="mr-1 h-4 w-4" />
                      {isAssisting ? "帮填中..." : "AI 帮填当前摘要"}
                    </Button>
                    <Button variant="outline" onClick={handleInsertAfter} disabled={isInserting}>
                      <Plus className="mr-1 h-4 w-4" />
                      {isInserting ? "插入中..." : "在后面插入摘要"}
                    </Button>
                    <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      {isDeleting ? "删除中..." : "删除当前摘要"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedSummary.aiGenerate ? (
                <Card className="border-primary/40">
                  <CardHeader>
                    <CardTitle>AI 帮填结果</CardTitle>
                    <CardDescription>确认后可将 AI 生成内容应用到当前摘要。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md bg-muted p-4 text-sm leading-6">
                      {selectedSummary.aiGenerate}
                    </div>
                    <Button onClick={handleApplyAI} disabled={isApplying}>
                      <Check className="mr-1 h-4 w-4" />
                      {isApplying ? "应用中..." : "应用 AI 结果"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Sparkles className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>{isGenerating ? "正在生成摘要..." : "还没有摘要内容"}</p>
                <p className="mt-1 text-sm">可以先新增摘要，或点击右上角 AI 帮填批量生成。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
