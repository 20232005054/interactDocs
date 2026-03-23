import { create } from "zustand";

export interface SelectedContext {
  type: "text" | "keyword" | "chapter" | null;
  content: string;
  id?: string;
  paragraphId?: string;
}

interface AIState {
  selectedContext: SelectedContext;
  isGenerating: boolean;
  streamingContent: string;
  setSelectedContext: (context: SelectedContext) => void;
  clearSelectedContext: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  clearStreamingContent: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  selectedContext: {
    type: null,
    content: "",
  },
  isGenerating: false,
  streamingContent: "",
  setSelectedContext: (context) => set({ selectedContext: context }),
  clearSelectedContext: () =>
    set({ selectedContext: { type: null, content: "" } }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  clearStreamingContent: () => set({ streamingContent: "" }),
}));
