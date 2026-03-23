import { create } from 'zustand';

interface Chapter {
  id: string;
  documentId: string;
  parentId: string | null;
  title: string;
  status: number; // 0-编辑中, 1-已完成
  orderIndex: number;
  updatedAt: string;
}

interface ChapterStore {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  isLoading: boolean;
  error: string | null;
  setChapters: (chapters: Chapter[]) => void;
  setCurrentChapter: (chapter: Chapter | null) => void;
  addChapter: (chapter: Chapter) => void;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  reorderChapters: (documentId: string, chapters: Chapter[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChapterStore = create<ChapterStore>((set) => ({
  chapters: [],
  currentChapter: null,
  isLoading: false,
  error: null,
  setChapters: (chapters) => set({ chapters }),
  setCurrentChapter: (currentChapter) => set({ currentChapter }),
  addChapter: (chapter) => set((state) => ({
    chapters: [...state.chapters, chapter]
  })),
  updateChapter: (id, updates) => set((state) => ({
    chapters: state.chapters.map(chapter => 
      chapter.id === id ? { ...chapter, ...updates, updatedAt: new Date().toISOString() } : chapter
    ),
    currentChapter: state.currentChapter?.id === id 
      ? { ...state.currentChapter, ...updates, updatedAt: new Date().toISOString() } 
      : state.currentChapter
  })),
  deleteChapter: (id) => set((state) => ({
    chapters: state.chapters.filter(chapter => chapter.id !== id),
    currentChapter: state.currentChapter?.id === id ? null : state.currentChapter
  })),
  reorderChapters: (documentId, chapters) => set((state) => ({
    chapters: state.chapters.map(chapter => 
      chapter.documentId === documentId 
        ? chapters.find(c => c.id === chapter.id) || chapter
        : chapter
    )
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
