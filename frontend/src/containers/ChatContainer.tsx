"use client";

import { useCallback } from "react";
import { AIAssistantPanel } from "@/components/chat/AIAssistantPanel";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";

export interface ChatContainerProps {
  documentId: string;
}

export function ChatContainer({}: ChatContainerProps) {
  const { editorContent, setEditorContent } = useDocumentStore();
  const { selectedText, clearSelectedText } = useEditorStore();

  const handleApplySuggestion = useCallback((content: string) => {
    if (selectedText) {
      // 替换选中的文本
      const newContent = editorContent.replace(selectedText, content);
      setEditorContent(newContent);
      clearSelectedText();
    } else {
      // 在光标位置插入或在末尾追加
      setEditorContent(editorContent + "\n\n" + content);
    }
  }, [editorContent, selectedText, setEditorContent, clearSelectedText]);

  return (
    <AIAssistantPanel
      onApplySuggestion={handleApplySuggestion}
      className="w-[350px]"
    />
  );
}
