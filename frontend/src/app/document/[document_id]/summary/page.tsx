"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContentHeader } from "@/components/document/ContentHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { Sparkles, Check, X } from "lucide-react";

export default function SummaryPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const { summary, setSummary } = useDocumentStore();
  const { setActiveContext } = useEditorStore();
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [content, setContent] = useState(summary?.content || "");

  useEffect(() => {
    setActiveContext("summary");
    const loadSummary = async () => {
      try {
        const response = await fetch(`/api/v1/documents/${documentId}/summary`);
        if (response.ok) {
          const data = await response.json();
          setSummary(data);
          setContent(data.content);
        }
      } catch (error) {
        console.error("加载摘要失败:", error);
      }
    };
    loadSummary();
  }, [setActiveContext, documentId, setSummary]);

  const handleGenerate = async () => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summary/generate`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedSummary(data.content);
        setShowConfirm(true);
      }
    } catch (error) {
      console.error("生成摘要失败:", error);
      // 模拟生成
      setGeneratedSummary(
        "这是一段由 AI 生成的示例摘要。在实际应用中，这里会显示根据文档内容生成的智能摘要。"
      );
      setShowConfirm(true);
    }
  };

  const handleApply = () => {
    setContent(generatedSummary);
    setShowConfirm(false);
  };

  const handleReject = () => {
    setGeneratedSummary("");
    setShowConfirm(false);
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("保存摘要失败:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ContentHeader
        title="文档摘要"
        onSave={handleSave}
        onAIAssist={handleGenerate}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 当前摘要 */}
          <Card>
            <CardHeader>
              <CardTitle>当前摘要</CardTitle>
              <CardDescription>
                编辑或生成文档摘要
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="文档摘要内容..."
                rows={8}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* AI 生成结果确认 */}
          {showConfirm && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>AI 生成摘要</CardTitle>
                </div>
                <CardDescription>
                  请查看并确认是否应用以下生成的摘要
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  {generatedSummary}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleReject}>
                    <X className="h-4 w-4 mr-1" />
                    放弃
                  </Button>
                  <Button onClick={handleApply} className="bg-primary hover:bg-primary/90">
                    <Check className="h-4 w-4 mr-1" />
                    应用
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 生成提示 */}
          {!showConfirm && !content && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">还没有摘要</p>
              <p className="text-sm">点击右上角的 AI 帮填按钮一键生成摘要</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
