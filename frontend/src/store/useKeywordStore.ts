import { create } from 'zustand';

interface Keyword {
  id: string;
  documentId: string;
  keyword: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface KeywordStore {
  keywords: Keyword[];
  isLoading: boolean;
  error: string | null;
  setKeywords: (keywords: Keyword[]) => void;
  addKeyword: (keyword: Keyword) => void;
  updateKeyword: (id: string, updates: Partial<Keyword>) => void;
  deleteKeyword: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useKeywordStore = create<KeywordStore>((set) => ({
  keywords: [],
  isLoading: false,
  error: null,
  setKeywords: (keywords) => set({ keywords }),
  addKeyword: (keyword) => set((state) => ({
    keywords: [...state.keywords, keyword]
  })),
  updateKeyword: (id, updates) => set((state) => ({
    keywords: state.keywords.map(keyword => 
      keyword.id === id ? { ...keyword, ...updates, updatedAt: new Date().toISOString() } : keyword
    )
  })),
  deleteKeyword: (id) => set((state) => ({
    keywords: state.keywords.filter(keyword => keyword.id !== id)
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
