"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentCard } from "@/components/document/DocumentCard";
import { Plus, FileText } from "lucide-react";
import type { Document } from "@/store/documentStore";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/v1/documents");
      if (response.ok) {
        const result = await response.json();
        // 后端返回格式: {code: 200, message: "成功", data: {items: [...]}}
        const documentsData = result.data?.items || [];
        // 映射文档数据，适配前端结构
        const mappedDocuments = documentsData.map((doc: any) => ({
          id: doc.document_id,
          title: doc.title,
          summary: doc.summary || "",
          purpose: doc.purpose || "",
          template: doc.template || "",
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        }));
        setDocuments(mappedDocuments);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error("获取文档列表失败:", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个文档吗？")) return;

    try {
      const response = await fetch(`/api/v1/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments(documents.filter((doc) => doc.id !== id));
      }
    } catch (error) {
      console.error("删除文档失败:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">我的文档</h2>
          <p className="text-muted-foreground mt-1">
            管理和编辑您的所有文档
          </p>
        </div>
        <Link href="/document">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            新建文档
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-card border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">还没有文档</h3>
          <p className="text-muted-foreground mb-6">
            创建您的第一个文档开始使用
          </p>
          <Link href="/document">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              新建文档
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              summary={doc.summary}
              updatedAt={doc.updatedAt}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
