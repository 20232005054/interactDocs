import { create } from 'zustand';

interface Paragraph {
  id: string;
  chapterId: string;
  content: string;
  paraType: string; // paragraph, heading-1 to heading-6
  orderIndex: number;
  aiEval: string | null;
  aiSuggestion: string | null;
  aiGenerate: string | null;
  isChange: number; // 0-无变更, 1-自身修改, 2-上游变更
}

interface ParagraphStore {
  paragraphs: Paragraph[];
  currentParagraph: Paragraph | null;
  isLoading: boolean;
  error: string | null;
  setParagraphs: (paragraphs: Paragraph[]) => void;
  setCurrentParagraph: (paragraph: Paragraph | null) => void;
  addParagraph: (paragraph: Paragraph) => void;
  updateParagraph: (id: string, updates: Partial<Paragraph>) => void;
  deleteParagraph: (id: string) => void;
  reorderParagraphs: (chapterId: string, paragraphs: Paragraph[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useParagraphStore = create<ParagraphStore>((set) => ({
  paragraphs: [],
  currentParagraph: null,
  isLoading: false,
  error: null,
  setParagraphs: (paragraphs) => set({ paragraphs }),
  setCurrentParagraph: (currentParagraph) => set({ currentParagraph }),
  addParagraph: (paragraph) => set((state) => ({
    paragraphs: [...state.paragraphs, paragraph]
  })),
  updateParagraph: (id, updates) => set((state) => ({
    paragraphs: state.paragraphs.map(paragraph => 
      paragraph.id === id ? { ...paragraph, ...updates } : paragraph
    ),
    currentParagraph: state.currentParagraph?.id === id 
      ? { ...state.currentParagraph, ...updates } 
      : state.currentParagraph
  })),
  deleteParagraph: (id) => set((state) => ({
    paragraphs: state.paragraphs.filter(paragraph => paragraph.id !== id),
    currentParagraph: state.currentParagraph?.id === id ? null : state.currentParagraph
  })),
  reorderParagraphs: (chapterId, paragraphs) => set((state) => ({
    paragraphs: state.paragraphs.map(paragraph => 
      paragraph.chapterId === chapterId 
        ? paragraphs.find(p => p.id === paragraph.id) || paragraph
        : paragraph
    )
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
