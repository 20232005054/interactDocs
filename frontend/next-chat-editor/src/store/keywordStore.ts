import { create } from 'zustand';

interface Keyword {
  keyword_id: string;
  document_id: string;
  keyword: string;
}

interface KeywordStore {
  keywords: Keyword[];
  isLoading: boolean;
  error: string | null;
  selectedKeywords: Set<string>;
  
  // 操作
  fetchKeywords: (documentId: string) => Promise<void>;
  createKeyword: (documentId: string, keyword: string) => Promise<void>;
  updateKeyword: (keywordId: string, keyword: string) => Promise<void>;
  deleteKeyword: (keywordId: string) => Promise<void>;
  generateKeywords: (documentId: string) => Promise<void>;
  toggleKeywordSelection: (keywordId: string) => void;
  clearSelectedKeywords: () => void;
}

export const useKeywordStore = create<KeywordStore>((set, get) => ({
  keywords: [],
  isLoading: false,
  error: null,
  selectedKeywords: new Set(),
  
  fetchKeywords: async (documentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/keywords`);
      const data = await response.json();
      
      if (data.code === 200) {
        set({ keywords: data.data.keywords || [], isLoading: false });
      } else {
        set({ error: '获取关键词失败', isLoading: false });
      }
    } catch (error) {
      console.error('获取关键词失败:', error);
      set({ error: '获取关键词失败', isLoading: false });
    }
  },
  
  createKeyword: async (documentId, keyword) => {
    if (!keyword.trim()) return;
    
    try {
      const response = await fetch('/api/v1/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          keyword: keyword.trim(),
        }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        // 重新获取关键词列表
        get().fetchKeywords(documentId);
      } else {
        set({ error: '创建关键词失败' });
      }
    } catch (error) {
      console.error('创建关键词失败:', error);
      set({ error: '创建关键词失败' });
    }
  },
  
  updateKeyword: async (keywordId, keyword) => {
    if (!keyword.trim()) return;
    
    try {
      const response = await fetch(`/api/v1/keywords/${keywordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        // 重新获取关键词列表
        const { keywords } = get();
        if (keywords.length > 0) {
          get().fetchKeywords(keywords[0].document_id);
        }
      } else {
        set({ error: '更新关键词失败' });
      }
    } catch (error) {
      console.error('更新关键词失败:', error);
      set({ error: '更新关键词失败' });
    }
  },
  
  deleteKeyword: async (keywordId) => {
    try {
      const response = await fetch(`/api/v1/keywords/${keywordId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      if (data.code === 200) {
        // 直接从状态中移除对应的关键词
        set((state) => ({
          keywords: state.keywords.filter(keyword => keyword.keyword_id !== keywordId),
          selectedKeywords: new Set([...state.selectedKeywords].filter(id => id !== keywordId))
        }));
      } else {
        set({ error: '删除关键词失败' });
      }
    } catch (error) {
      console.error('删除关键词失败:', error);
      set({ error: '删除关键词失败' });
    }
  },
  
  generateKeywords: async (documentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/keywords/ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        // 重新获取关键词列表
        get().fetchKeywords(documentId);
      } else {
        set({ error: 'AI 生成关键词失败', isLoading: false });
      }
    } catch (error) {
      console.error('AI 生成关键词失败:', error);
      set({ error: 'AI 生成关键词失败', isLoading: false });
    }
  },
  
  toggleKeywordSelection: (keywordId) => {
    set((state) => {
      const newSet = new Set(state.selectedKeywords);
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId);
      } else {
        newSet.add(keywordId);
      }
      return { selectedKeywords: newSet };
    });
  },
  
  clearSelectedKeywords: () => set({ selectedKeywords: new Set() })
}));
