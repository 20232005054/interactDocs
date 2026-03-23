"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditorContainer } from "@/containers/EditorContainer";
import { useDocumentStore } from "@/store/documentStore";

export default function ChapterPage() {
  const params = useParams();
  const documentId = params.document_id as string;
  const chapterId = params.chapter_id as string;
  const [initialContent, setInitialContent] = useState("");
  const [loading, setLoading] = useState(true);
  const { toc } = useDocumentStore();

  useEffect(() => {
    const loadChapter = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/documents/${documentId}/chapters/${chapterId}`
        );
        if (response.ok) {
          const data = await response.json();
          setInitialContent(data.content || "");
        } else {
          // 使用模拟内容
          setInitialContent(`# ${toc.find((c) => c.id === chapterId)?.title || "章节标题"}

在这里开始编写您的章节内容...

## 小节标题

- 要点 1
- 要点 2
- 要点 3

## 另一个小节

正文内容...`);
        }
      } catch (error) {
        console.error("加载章节失败:", error);
        setInitialContent("# 新章节\n\n开始编写内容...");
      } finally {
        setLoading(false);
      }
    };

    loadChapter();
  }, [documentId, chapterId, toc]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <EditorContainer
      documentId={documentId}
      chapterId={chapterId}
      initialContent={initialContent}
    />
  );
}
