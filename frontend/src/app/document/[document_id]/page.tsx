"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentHeader } from "@/components/document/ContentHeader";
import { useDocumentStore } from "@/store/documentStore";

export default function DocumentOverviewPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const { activeDocument, setActiveDocument } = useDocumentStore();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: activeDocument?.title || "",
    purpose: activeDocument?.purpose || "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updated = await response.json();
        setActiveDocument(updated);
      }
    } catch (error) {
      console.error("保存失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ContentHeader
        title="文档基本信息"
        onSave={handleSave}
        isSaving={isSaving}
        showAIAssist={false}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>文档设置</CardTitle>
              <CardDescription>
                管理文档的基本信息和配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">文档标题</label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="请输入文档标题"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">用途目标</label>
                <Textarea
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  placeholder="描述这个文档的用途和目标..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">模板</label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {activeDocument?.template || "default"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">创建时间</label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {activeDocument?.createdAt
                    ? new Date(activeDocument.createdAt).toLocaleString("zh-CN")
                    : "-"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">最后更新</label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {activeDocument?.updatedAt
                    ? new Date(activeDocument.updatedAt).toLocaleString("zh-CN")
                    : "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>全局变量</CardTitle>
              <CardDescription>
                设置文档中可复用的全局变量
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                全局变量功能即将推出...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
