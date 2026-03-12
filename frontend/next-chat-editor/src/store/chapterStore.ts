import { create } from 'zustand';

interface Chapter {
  id: string;
  document_id: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ChapterState {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentChapter: (chapter: Chapter | null) => void;
  fetchChapters: (documentId: string) => Promise<void>;
  createChapter: (documentId: string, title: string) => Promise<Chapter>;
  updateChapter: (id: string, data: Partial<Chapter>) => Promise<Chapter>;
  deleteChapter: (id: string) => Promise<void>;
  reorderChapters: (documentId: string, chapterIds: string[]) => Promise<void>;
}

export const useChapterStore = create<ChapterState>((set) => ({
  chapters: [],
  currentChapter: null,
  isLoading: false,
  error: null,
  
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  
  fetchChapters: async (documentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/documents/${documentId}/chapters`);
      if (!response.ok) throw new Error('Failed to fetch chapters');
      const data = await response.json();
      set({ chapters: data, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch chapters', isLoading: false });
    }
  },
  
  createChapter: async (documentId, title) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/documents/${documentId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('Failed to create chapter');
      const newChapter = await response.json();
      set((state) => ({
        chapters: [...state.chapters, newChapter],
        currentChapter: newChapter,
        isLoading: false,
      }));
      return newChapter;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create chapter', isLoading: false });
      throw error;
    }
  },
  
  updateChapter: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/chapters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update chapter');
      const updatedChapter = await response.json();
      set((state) => ({
        chapters: state.chapters.map(chapter => chapter.id === id ? updatedChapter : chapter),
        currentChapter: state.currentChapter?.id === id ? updatedChapter : state.currentChapter,
        isLoading: false,
      }));
      return updatedChapter;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update chapter', isLoading: false });
      throw error;
    }
  },
  
  deleteChapter: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/chapters/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete chapter');
      set((state) => ({
        chapters: state.chapters.filter(chapter => chapter.id !== id),
        currentChapter: state.currentChapter?.id === id ? null : state.currentChapter,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete chapter', isLoading: false });
      throw error;
    }
  },
  
  reorderChapters: async (documentId, chapterIds) => {
    set({ isLoading: true, error: null });
    try {
      // 这里可以调用后端API来更新章节顺序
      // 暂时只更新本地状态
      set((state) => {
        const reorderedChapters = chapterIds.map((id, index) => {
          const chapter = state.chapters.find(ch => ch.id === id);
          return chapter ? { ...chapter, order: index + 1 } : null;
        }).filter(Boolean) as Chapter[];
        
        return {
          chapters: reorderedChapters,
          isLoading: false,
        };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reorder chapters', isLoading: false });
      throw error;
    }
  },
}));
