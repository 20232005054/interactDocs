"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { ContentHeader } from "@/components/document/ContentHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";

interface KeywordResponseItem {
  keyword_id: string;
  document_id: string;
  keyword: string;
}

function mapKeywords(items: KeywordResponseItem[]) {
  return items.map((item) => ({
    id: item.keyword_id,
    documentId: item.document_id,
    word: item.keyword,
  }));
}

export default function KeywordPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const { keywords, setKeywords, addKeyword, removeKeyword } = useDocumentStore();
  const { setActiveContext } = useEditorStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  useEffect(() => {
    setActiveContext("keyword");
  }, [setActiveContext]);

  useEffect(() => {
    const loadKeywords = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/v1/documents/${documentId}/keywords`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.message || "加载关键词失败");
        }

        const items: KeywordResponseItem[] = Array.isArray(result?.data?.keywords)
          ? result.data.keywords
          : [];

        setKeywords(mapKeywords(items));
      } catch (error) {
        console.error("加载关键词失败", error);
        setKeywords([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadKeywords();
  }, [documentId, setKeywords]);

  useEffect(() => {
    if (selectedKeyword && !keywords.some((keyword) => keyword.id === selectedKeyword)) {
      setSelectedKeyword(keywords[0]?.id ?? null);
    }

    if (!selectedKeyword && keywords.length > 0) {
      setSelectedKeyword(keywords[0].id);
    }
  }, [keywords, selectedKeyword]);

  const handleAddKeyword = () => {
    const value = newKeyword.trim();

    if (!value) {
      return;
    }

    addKeyword({
      documentId,
      word: value,
    });
    setNewKeyword("");
  };

  const handleGenerateKeywords = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/keywords/ai/assist`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "生成关键词失败");
      }

      const items: KeywordResponseItem[] = Array.isArray(result?.data?.keywords)
        ? result.data.keywords
        : [];

      setKeywords(mapKeywords(items));
    } catch (error) {
      console.error("生成关键词失败", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    console.log("保存关键词", keywords);
  };

  return (
    <div className="flex h-full flex-col">
      <ContentHeader
        title="关键词管理"
        onSave={handleSave}
        onAIAssist={handleGenerateKeywords}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r bg-card">
          <div className="border-b p-4">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(event) => setNewKeyword(event.target.value)}
                placeholder="添加关键词..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleAddKeyword();
                  }
                }}
              />
              <Button size="icon" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100%-73px)]">
            <div className="p-2">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">加载中...</div>
              ) : keywords.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">暂无关键词</div>
              ) : (
                keywords.map((keyword) => (
                  <div
                    key={keyword.id}
                    onClick={() => setSelectedKeyword(keyword.id)}
                    className={cn(
                      "group mb-1 flex cursor-pointer items-center justify-between rounded-md p-3",
                      selectedKeyword === keyword.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{keyword.word}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeKeyword(keyword.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
