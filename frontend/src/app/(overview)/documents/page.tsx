"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentCard } from "@/components/document/DocumentCard";
import { Plus, FileText } from "lucide-react";
import type { Document } from "@/store/documentStore";

interface DocumentListItem {
  document_id: string;
  title: string;
  summary?: string;
  purpose?: string;
  template?: string;
  created_at: string;
  updated_at: string;
}

async function fetchDocumentPage(page: number, pageSize: number) {
  const response = await fetch(
    `/api/v1/documents?page=${page}&page_size=${pageSize}`
  );

  if (!response.ok) {
    throw new Error("获取文档列表失败");
  }

  const result = await response.json();
  const documentsData: DocumentListItem[] = result.data?.items || [];
  const documents = documentsData.map((doc) => ({
    id: doc.document_id,
    title: doc.title,
    summary: doc.summary || "",
    purpose: doc.purpose || "",
    template: doc.template || "",
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }));

  return {
    total: result.data?.total || 0,
    documents,
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    // 从 localStorage 读取保存的 pageSize，默认 9
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("documentsPageSize");
      return saved ? parseInt(saved, 10) : 9;
    }
    return 9;
  });
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);

      try {
        const result = await fetchDocumentPage(currentPage, pageSize);
        setDocuments(result.documents);
        setTotal(result.total);
      } catch (error) {
        console.error("获取文档列表失败:", error);
        setDocuments([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [currentPage, pageSize]);

  // 保存 pageSize 到 localStorage
  const handlePageSizeChange = (newSize: number) => {
    setCurrentPage(1);
    setPageSize(newSize);
    localStorage.setItem("documentsPageSize", newSize.toString());
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个文档吗？")) return;

    try {
      const response = await fetch(`/api/v1/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const nextTotal = Math.max(0, total - 1);
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));

        if (currentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages);
        } else {
          const result = await fetchDocumentPage(currentPage, pageSize);
          setDocuments(result.documents);
          setTotal(result.total);
        }
      }
    } catch (error) {
      console.error("删除文档失败:", error);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">我的文档</h2>
          <p className="mt-1 text-muted-foreground">管理和编辑您的所有文档</p>
        </div>
        <Link href="/document">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            新建文档
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border bg-card"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">还没有文档</h3>
          <p className="mb-6 text-muted-foreground">
            创建您的第一个文档开始使用
          </p>
          <Link href="/document">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              新建文档
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      {documents.length > 0 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录，当前第 {currentPage} / {totalPages} 页
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              每页
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={pageSize}
                onChange={(e) => {
                  handlePageSizeChange(Number(e.target.value));
                }}
              >
                {[6, 9, 12, 18].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
                {/* 如果当前 pageSize 不在选项中，添加一个隐藏选项 */}
                {![6, 9, 12, 18].includes(pageSize) && (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                )}
              </select>
              条
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage >= totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
