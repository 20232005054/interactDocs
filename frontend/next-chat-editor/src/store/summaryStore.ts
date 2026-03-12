import { create } from 'zustand';

interface Summary {
  summary_id: string;
  document_id: string;
  title: string;
  content: string;
  order_index: number;
}

interface SummaryKeywordLink {
  summary_id: string;
  summary_title: string;
  keywords: any[];
}

interface SummaryStore {
  summaries: Summary[];
  summaryKeywordLinks: SummaryKeywordLink[];
  isLoading: boolean;
  generatingSummary: boolean;
  error: string | null;
  selectedSummaries: Set<string>;
  
  // 操作
  fetchSummaries: (documentId: string) => Promise<void>;
  fetchSummaryKeywordLinks: (documentId: string) => Promise<void>;
  createSummary: (documentId: string) => Promise<void>;
  updateSummary: (summaryId: string, title: string, content: string) => Promise<void>;
  deleteSummary: (summaryId: string) => Promise<void>;
  addNextSummary: (documentId: string, summaryId: string) => Promise<void>;
  generateSummary: (documentId: string) => Promise<void>;
  assistSummary: (documentId: string, summaryId: string) => Promise<void>;
  toggleSummarySelection: (summaryId: string) => void;
  clearSelectedSummaries: () => void;
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  summaries: [],
  summaryKeywordLinks: [],
  isLoading: false,
  generatingSummary: false,
  error: null,
  selectedSummaries: new Set(),
  
  fetchSummaries: async (documentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const data = await response.json();
      // 按order_index排序
      const sortedSummaries = (data.data.summaries || []).sort((a: Summary, b: Summary) => (a.order_index || 0) - (b.order_index || 0));
      set({ summaries: sortedSummaries, isLoading: false });
    } catch (error) {
      console.error('Error fetching summaries:', error);
      set({ error: '获取摘要失败', isLoading: false });
    }
  },
  
  fetchSummaryKeywordLinks: async (documentId) => {
    try {
      // 获取所有摘要
      const summariesResponse = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!summariesResponse.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const summariesData = await summariesResponse.json();
      const summariesList = summariesData.data.summaries || [];

      // 对每个摘要获取关联的关键词
      const links = [];
      for (const summary of summariesList) {
        const keywordsResponse = await fetch(`/api/v1/summaries/${summary.summary_id}/keywords`);
        if (keywordsResponse.ok) {
          const keywordsData = await keywordsResponse.json();
          const keywords = keywordsData.data.keywords || [];
          links.push({
            summary_id: summary.summary_id,
            summary_title: summary.title,
            keywords: keywords
          });
        }
      }
      set({ summaryKeywordLinks: links });
    } catch (err) {
      console.error('Error fetching summary-keyword links:', err);
    }
  },
  
  createSummary: async (documentId) => {
    try {
      // 计算新摘要的order_index
      const { summaries } = get();
      const newOrderIndex = summaries.length;
      
      const response = await fetch('/api/v1/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: '',
          content: '',
          order_index: newOrderIndex
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create summary');
      }
      const data = await response.json();
      const newSummary = data.data;
      set((state) => ({
        summaries: [...state.summaries, newSummary]
      }));
      // 更新摘要关键词关联表
      get().fetchSummaryKeywordLinks(documentId);
    } catch (err) {
      console.error('Error creating summary:', err);
      set({ error: '创建摘要失败' });
    }
  },
  
  updateSummary: async (summaryId, title, content) => {
    try {
      const response = await fetch(`/api/v1/summaries/${summaryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          content: content
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update summary');
      }
      const data = await response.json();
      const updatedSummary = data.data;
      set((state) => ({
        summaries: state.summaries.map((s) => 
          s.summary_id === summaryId ? updatedSummary : s
        )
      }));
    } catch (err) {
      console.error('Error updating summary:', err);
      set({ error: '更新摘要失败' });
    }
  },
  
  deleteSummary: async (summaryId) => {
    try {
      const response = await fetch(`/api/v1/summaries/${summaryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }
      const { summaries } = get();
      const updatedSummaries = summaries.filter((s) => s.summary_id !== summaryId);
      // 更新剩余摘要的order_index
      updatedSummaries.forEach((s, index) => {
        s.order_index = index;
        // 同步更新到服务器
        fetch(`/api/v1/summaries/${s.summary_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_index: s.order_index
          }),
        });
      });
      set((state) => ({
        summaries: updatedSummaries,
        selectedSummaries: new Set([...state.selectedSummaries].filter(id => id !== summaryId))
      }));
      // 更新摘要关键词关联表
      const documentId = summaries[0]?.document_id;
      if (documentId) {
        get().fetchSummaryKeywordLinks(documentId);
      }
    } catch (err) {
      console.error('Error deleting summary:', err);
      set({ error: '删除摘要失败' });
    }
  },
  
  addNextSummary: async (documentId, summaryId) => {
    try {
      // 找到当前摘要
      const { summaries } = get();
      const currentSummary = summaries.find((s) => s.summary_id === summaryId);
      if (!currentSummary) return;
      
      // 计算新摘要的order_index
      const currentOrderIndex = currentSummary.order_index || 0;
      const newOrderIndex = currentOrderIndex + 1;
      
      // 创建新摘要
      const response = await fetch('/api/v1/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: '',
          content: '',
          order_index: newOrderIndex
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create summary');
      }
      const data = await response.json();
      const newSummary = data.data;
      
      // 创建更新后的摘要数组
      const updatedSummaries = [...summaries];
      
      // 找到当前摘要的位置并在其后添加新摘要
      const currentIndex = updatedSummaries.findIndex((s) => s.summary_id === summaryId);
      updatedSummaries.splice(currentIndex + 1, 0, newSummary);
      
      // 更新后续摘要的order_index
      updatedSummaries.forEach((s, index) => {
        // 只更新order_index大于等于新摘要order_index的摘要
        if (s.order_index >= newOrderIndex && s.summary_id !== newSummary.summary_id) {
          s.order_index += 1;
          // 同步更新到服务器
          fetch(`/api/v1/summaries/${s.summary_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_index: s.order_index
            }),
          });
        }
      });
      
      // 按order_index排序后再设置状态
      const sortedSummaries = updatedSummaries.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      set({ summaries: sortedSummaries });
      // 更新摘要关键词关联表
      get().fetchSummaryKeywordLinks(documentId);
    } catch (err) {
      console.error('Error creating summary:', err);
      set({ error: '创建摘要失败' });
    }
  },
  
  generateSummary: async (documentId) => {
    set({ generatingSummary: true, error: null });
    try {
      const response = await fetch(`/api/v1/summaries/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      const data = await response.json();
      const generatedSummaries = data.data.summaries || [];
      
      // 清除现有的摘要
      set({ summaries: [] });
      
      // 保存生成的摘要到服务器
      const savedSummaries = [];
      for (let i = 0; i < generatedSummaries.length; i++) {
        const summary = generatedSummaries[i];
        const saveResponse = await fetch('/api/v1/summaries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: documentId,
            title: summary.title,
            content: summary.content,
            order_index: i
          }),
        });
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          savedSummaries.push(saveData.data);
        }
      }
      
      // 重新获取摘要列表和关联表
      await get().fetchSummaries(documentId);
      get().fetchSummaryKeywordLinks(documentId);
    } catch (err) {
      console.error('Error generating summary:', err);
      set({ error: '生成摘要失败', generatingSummary: false });
    } finally {
      set({ generatingSummary: false });
    }
  },
  
  assistSummary: async (documentId, summaryId) => {
    try {
      const response = await fetch(`/api/v1/summaries/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          summary_ids: [summaryId]
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to assist summary');
      }
      const data = await response.json();
      const updatedSummary = data.data;
      
      // 更新摘要列表
      set((state) => ({
        summaries: state.summaries.map((s) => 
          s.summary_id === summaryId ? updatedSummary : s
        )
      }));
    } catch (error) {
      console.error('Error assisting summary:', error);
      set({ error: '帮填摘要失败' });
    }
  },
  
  toggleSummarySelection: (summaryId) => {
    set((state) => {
      const newSet = new Set(state.selectedSummaries);
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId);
      } else {
        newSet.add(summaryId);
      }
      return { selectedSummaries: newSet };
    });
  },
  
  clearSelectedSummaries: () => {
    set({ selectedSummaries: new Set() });
  }
}));
