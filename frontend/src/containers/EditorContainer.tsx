"use client";

import { useEffect, useCallback, useState } from "react";
import { MonacoEditorWrapper } from "@/components/document/MonacoEditorWrapper";
import { ContentHeader } from "@/components/document/ContentHeader";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { useDebounce } from "@/hooks/useDebounce";

export interface EditorContainerProps {
  documentId: string;
  chapterId?: string;
  initialContent?: string;
}

export function EditorContainer({
  documentId,
  chapterId,
  initialContent = "",
}: EditorContainerProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("未命名章节");

  const { setEditorContent, toc } = useDocumentStore();
  const { setActiveContext } = useEditorStore();

  useEffect(() => {
    setActiveContext("chapter");
    if (chapterId) {
      const chapter = toc.find((c) => c.id === chapterId);
      if (chapter) {
        setTitle(chapter.title);
      }
    }
  }, [chapterId, toc, setActiveContext]);

  const debouncedContent = useDebounce(content, 2000);

  useEffect(() => {
    setEditorContent(content);
  }, [content, setEditorContent]);

  // Auto-save effect
  useEffect(() => {
    if (!chapterId || debouncedContent === initialContent) return;

    const save = async () => {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/v1/documents/${documentId}/chapters/${chapterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: debouncedContent }),
        });

        if (!response.ok) {
          console.error("自动保存失败");
        }
      } catch (error) {
        console.error("自动保存出错:", error);
      } finally {
        setIsSaving(false);
      }
    };

    save();
  }, [debouncedContent, documentId, chapterId, initialContent]);

  const handleSave = useCallback(async () => {
    if (!chapterId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }
    } catch (error) {
      console.error("保存出错:", error);
    } finally {
      setIsSaving(false);
    }
  }, [content, documentId, chapterId]);

  const handleAIAssist = useCallback(() => {
    // 触发 AI 辅助功能，可以通过全局状态通知 AI 面板
    console.log("请求 AI 辅助");
  }, []);

  return (
    <div className="flex flex-col h-full">
      <ContentHeader
        title={title}
        onSave={handleSave}
        onAIAssist={handleAIAssist}
        isSaving={isSaving}
      />
      <div className="flex-1 p-4">
        <MonacoEditorWrapper
          value={content}
          onChange={setContent}
          language="markdown"
          height="100%"
        />
      </div>
    </div>
  );
}
