"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContentHeader } from "@/components/document/ContentHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KeywordPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const { keywords, setKeywords, addKeyword, removeKeyword } = useDocumentStore();
  const { setActiveContext } = useEditorStore();
  const [isLoading, setIsLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  useEffect(() => {
    setActiveContext("keyword");
    const loadKeywords = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/v1/documents/${documentId}/keywords`);
        if (response.ok) {
          const data = await response.json();
          setKeywords(data);
        }
      } catch (error) {
        console.error("加载关键词失败:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadKeywords();
  }, [setActiveContext, documentId, setKeywords]);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    addKeyword({
      documentId,
      word: newKeyword.trim(),
    });
    setNewKeyword("");
  };

  const handleGenerateKeywords = async () => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/keywords/generate`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setKeywords([...keywords, ...data]);
      }
    } catch (error) {
      console.error("生成关键词失败:", error);
    }
  };

  const handleSave = async () => {
    // 保存所有关键词
    console.log("保存关键词", keywords);
  };

  return (
    <div className="h-full flex flex-col">
      <ContentHeader
        title="关键词管理"
        onSave={handleSave}
        onAIAssist={handleGenerateKeywords}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧关键词列表 */}
        <div className="w-80 border-r bg-card">
          <div className="p-4 border-b">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="添加关键词..."
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              />
              <Button size="icon" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100%-73px)]">
            <div className="p-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  加载中...
                </div>
              ) : keywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无关键词
                </div>
              ) : (
                keywords.map((keyword) => (
                  <div
                    key={keyword.id}
                    onClick={() => setSelectedKeyword(keyword.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md cursor-pointer mb-1",
                      selectedKeyword === keyword.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{keyword.word}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
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

        {/* 右侧详情 */}
        <div className="flex-1 p-6">
          {selectedKeyword ? (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">
                {keywords.find((k) => k.id === selectedKeyword)?.word}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">描述</label>
                  <textarea
                    className="w-full h-32 p-3 rounded-md border bg-transparent"
                    placeholder="添加关键词描述..."
                    defaultValue={
                      keywords.find((k) => k.id === selectedKeyword)?.description || ""
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择一个关键词查看详情</p>
                <p className="text-sm mt-1">或点击 AI 帮填一键生成关键词</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
