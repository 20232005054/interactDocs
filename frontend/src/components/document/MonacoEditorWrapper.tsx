"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorStore } from "@/store/editorStore";
import type { editor } from "monaco-editor";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react"),
  { ssr: false }
);

export interface MonacoEditorWrapperProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
}

export function MonacoEditorWrapper({
  value,
  onChange,
  language = "markdown",
  height = "100%",
  readOnly = false,
}: MonacoEditorWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const setSelectedText = useEditorStore((state) => state.setSelectedText);

  // Use requestAnimationFrame to avoid synchronous setState in effect
  const handleMount = useCallback(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorInstance.onDidChangeCursorSelection((e) => {
      const selection = editorInstance.getModel()?.getValueInRange(e.selection) || "";
      setSelectedText(selection);
    });
  }, [setSelectedText]);

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden">
      {!mounted && <Skeleton className="w-full h-full min-h-[400px] absolute inset-0" />}
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(value) => onChange?.(value || "")}
        onMount={(editor) => {
          handleMount();
          handleEditorDidMount(editor);
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: false,
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
        }}
        theme="vs-light"
      />
    </div>
  );
}
