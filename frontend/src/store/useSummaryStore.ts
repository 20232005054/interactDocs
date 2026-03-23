import { create } from 'zustand';

interface Summary {
  id: string;
  documentId: string;
  title: string;
  content: string;
  version: number;
  isChange: number; // 0-无变更, 1-自身修改, 3-下游变更
  aiGenerate: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface SummaryStore {
  summaries: Summary[];
  currentSummary: Summary | null;
  isLoading: boolean;
  error: string | null;
  setSummaries: (summaries: Summary[]) => void;
  setCurrentSummary: (summary: Summary | null) => void;
  addSummary: (summary: Summary) => void;
  updateSummary: (id: string, updates: Partial<Summary>) => void;
  deleteSummary: (id: string) => void;
  reorderSummaries: (documentId: string, summaries: Summary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSummaryStore = create<SummaryStore>((set) => ({
  summaries: [],
  currentSummary: null,
  isLoading: false,
  error: null,
  setSummaries: (summaries) => set({ summaries }),
  setCurrentSummary: (currentSummary) => set({ currentSummary }),
  addSummary: (summary) => set((state) => ({
    summaries: [...state.summaries, summary]
  })),
  updateSummary: (id, updates) => set((state) => ({
    summaries: state.summaries.map(summary => 
      summary.id === id ? { ...summary, ...updates, updatedAt: new Date().toISOString() } : summary
    ),
    currentSummary: state.currentSummary?.id === id 
      ? { ...state.currentSummary, ...updates, updatedAt: new Date().toISOString() } 
      : state.currentSummary
  })),
  deleteSummary: (id) => set((state) => ({
    summaries: state.summaries.filter(summary => summary.id !== id),
    currentSummary: state.currentSummary?.id === id ? null : state.currentSummary
  })),
  reorderSummaries: (documentId, summaries) => set((state) => ({
    summaries: state.summaries.map(summary => 
      summary.documentId === documentId 
        ? summaries.find(s => s.id === summary.id) || summary
        : summary
    )
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
