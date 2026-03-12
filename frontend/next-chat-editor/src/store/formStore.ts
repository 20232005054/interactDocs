import { create } from 'zustand';
import { Metadata, FormData, Field, Summary as FormSummary } from '../lib/types/form';
import { Template } from '../lib/types/template';
import { Keyword } from '../lib/types/keyword';
import { Summary } from '../lib/types/summary';
import { fetchMetadata } from '../lib/api/metadata';
import { fetchTemplatePurposes, fetchTemplatesByPurpose } from '../lib/api/template';
import { createDocument } from '../lib/api/document';
import { batchCreateKeywords } from '../lib/api/keyword';
import { batchCreateSummaries } from '../lib/api/summary';
import { initializeFormData, extractRequiredFields } from '../lib/utils/form';

interface FormState {
  // 状态
  metadata: Metadata | null;
  formData: FormData;
  keywords: string[];
  keywordInput: string;
  summaries: FormSummary[];
  templatePurposes: string[];
  templatesByPurpose: Record<string, Template[]>;
  selectedTemplate: string;
  loading: boolean;
  error: string | null;
  
  // 操作
  setFormData: (data: FormData | ((prev: FormData) => FormData)) => void;
  setKeywordInput: (input: string) => void;
  addKeyword: () => void;
  removeKeyword: (index: number) => void;
  addSummary: () => void;
  updateSummary: (index: number, field: 'title' | 'content', value: string) => void;
  removeSummary: (index: number) => void;
  setSelectedTemplate: (templateId: string) => void;
  fetchMetadata: () => Promise<void>;
  fetchTemplatePurposes: () => Promise<void>;
  fetchTemplatesByPurpose: (purpose: string) => Promise<void>;
  generateDocument: () => Promise<void>;
}

export const useFormStore = create<FormState>((set, get) => ({
  // 初始状态
  metadata: null,
  formData: {},
  keywords: [],
  keywordInput: '',
  summaries: [{ title: '', content: '' }],
  templatePurposes: [],
  templatesByPurpose: {},
  selectedTemplate: '',
  loading: true,
  error: null,
  
  // 操作
  setFormData: (data) => set((state) => ({
    formData: typeof data === 'function' ? data(state.formData) : data
  })),
  
  setKeywordInput: (input) => set({ keywordInput: input }),
  
  addKeyword: () => {
    const { keywordInput, keywords } = get();
    if (keywordInput.trim()) {
      set({ 
        keywords: [...keywords, keywordInput.trim()],
        keywordInput: '' 
      });
    }
  },
  
  removeKeyword: (index) => {
    const { keywords } = get();
    set({ 
      keywords: keywords.filter((_, i) => i !== index) 
    });
  },
  
  addSummary: () => {
    const { summaries } = get();
    set({ 
      summaries: [...summaries, { title: '', content: '' }] 
    });
  },
  
  updateSummary: (index, field, value) => {
    const { summaries } = get();
    const newSummaries = [...summaries];
    newSummaries[index] = { ...newSummaries[index], [field]: value };
    set({ summaries: newSummaries });
  },
  
  removeSummary: (index) => {
    const { summaries } = get();
    set({ 
      summaries: summaries.filter((_, i) => i !== index) 
    });
  },
  
  setSelectedTemplate: (templateId) => set({ selectedTemplate: templateId }),
  
  fetchMetadata: async () => {
    set({ loading: true, error: null });
    try {
      const metadata = await fetchMetadata();
      const formData = initializeFormData(metadata.fields);
      set({ 
        metadata, 
        formData, 
        keywords: [],
        keywordInput: '',
        loading: false 
      });
      // 获取模板用途
      get().fetchTemplatePurposes();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch metadata',
        loading: false 
      });
    }
  },
  
  fetchTemplatePurposes: async () => {
    try {
      const purposes = await fetchTemplatePurposes();
      set({ templatePurposes: purposes });
    } catch (error) {
      console.error('Error fetching template purposes:', error);
    }
  },
  
  fetchTemplatesByPurpose: async (purpose) => {
    try {
      const templates = await fetchTemplatesByPurpose(purpose);
      set((state) => ({
        templatesByPurpose: {
          ...state.templatesByPurpose,
          [purpose]: templates
        },
        selectedTemplate: ''
      }));
    } catch (error) {
      console.error('Error fetching templates by purpose:', error);
    }
  },
  
  generateDocument: async () => {
    const { metadata, formData, keywords, summaries, selectedTemplate } = get();
    
    if (!metadata) {
      set({ error: 'Metadata not loaded' });
      return;
    }
    
    try {
      // 提取必填字段
      let requiredFields = extractRequiredFields(metadata.fields, formData);
      
      // 添加模板ID（可选）
      if (selectedTemplate) {
        requiredFields.template_id = selectedTemplate;
      }
      
      // 创建文档
      const documentId = await createDocument(requiredFields);
      
      // 批量创建关键词
      if (keywords.length > 0) {
        const keywordsData = {
          keywords: keywords.map(keyword => ({
            document_id: documentId,
            keyword: keyword
          }))
        };
        await batchCreateKeywords(keywordsData);
      }
      
      // 批量创建摘要
      const nonEmptySummaries = summaries.filter(summary => summary.title.trim() && summary.content.trim());
      if (nonEmptySummaries.length > 0) {
        const summariesData = {
          summaries: nonEmptySummaries.map(summary => ({
            document_id: documentId,
            title: summary.title,
            content: summary.content
          }))
        };
        await batchCreateSummaries(summariesData);
      }
      
      // 跳转到新生成的文档编辑页面
      window.location.href = `/document/${documentId}`;
    } catch (error) {
      console.error('Error generating document:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to generate document' 
      });
    }
  },
}));
