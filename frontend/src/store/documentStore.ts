import { create } from "zustand";

export interface Document {
  id: string;
  title: string;
  purpose: string;
  template: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
}

export interface Chapter {
  id: string;
  documentId: string;
  title: string;
  order: number;
  content?: string;
}

export interface Keyword {
  id: string;
  documentId: string;
  word: string;
  description?: string;
}

export interface DocumentSummary {
  id: string;
  documentId: string;
  content: string;
  generatedAt: string;
}

interface DocumentState {
  activeDocument: Document | null;
  toc: Chapter[];
  editorContent: string;
  keywords: Keyword[];
  summary: DocumentSummary | null;
  setActiveDocument: (document: Document | null) => void;
  setToc: (toc: Chapter[]) => void;
  updateChapterOrder: (chapterId: string, newOrder: number) => void;
  setEditorContent: (content: string) => void;
  setKeywords: (keywords: Keyword[]) => void;
  addKeyword: (keyword: Omit<Keyword, "id">) => void;
  removeKeyword: (id: string) => void;
  setSummary: (summary: DocumentSummary | null) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  activeDocument: null,
  toc: [],
  editorContent: "",
  keywords: [],
  summary: null,
  setActiveDocument: (document) => set({ activeDocument: document }),
  setToc: (toc) => set({ toc }),
  updateChapterOrder: (chapterId, newOrder) =>
    set((state) => ({
      toc: state.toc.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, order: newOrder } : chapter
      ),
    })),
  setEditorContent: (content) => set({ editorContent: content }),
  setKeywords: (keywords) => set({ keywords }),
  addKeyword: (keyword) =>
    set((state) => ({
      keywords: [
        ...state.keywords,
        { ...keyword, id: Math.random().toString(36).substring(7) },
      ],
    })),
  removeKeyword: (id) =>
    set((state) => ({
      keywords: state.keywords.filter((k) => k.id !== id),
    })),
  setSummary: (summary) => set({ summary }),
}));
