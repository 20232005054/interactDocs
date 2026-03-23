import { create } from "zustand";

export type EditorContext = "chapter" | "keyword" | "summary" | "overview";

interface EditorState {
  currentDocumentId: string | null;
  selectedText: string;
  activeContext: EditorContext;
  setCurrentDocumentId: (id: string | null) => void;
  setSelectedText: (text: string) => void;
  setActiveContext: (context: EditorContext) => void;
  clearSelectedText: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentDocumentId: null,
  selectedText: "",
  activeContext: "overview",
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setSelectedText: (text) => set({ selectedText: text }),
  setActiveContext: (context) => set({ activeContext: context }),
  clearSelectedText: () => set({ selectedText: "" }),
}));
