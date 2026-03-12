import { Chapter } from '../types/chapter';
import { Block } from '../types/block';

export const chapterApi = {
  // 获取章节列表
  getChapters: async (documentId: string): Promise<Chapter[]> => {
    const response = await fetch(`/api/documents/${documentId}/chapters`);
    if (!response.ok) {
      throw new Error('Failed to fetch chapters');
    }
    const data = await response.json();
    return data.data.chapters;
  },

  // 获取章节详情
  getChapter: async (chapterId: string): Promise<{ chapter: Chapter; paragraphs: Block[] }> => {
    const response = await fetch(`/api/v1/chapters/${chapterId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch chapter details');
    }
    const data = await response.json();
    const chapter = data.data;
    const paragraphs = chapter.paragraphs.map((p: any) => ({
      id: p.paragraph_id,
      type: p.para_type,
      content: p.content,
      order_index: p.order_index,
      metadata: {
        ai_eval: p.ai_eval,
        ai_suggestion: p.ai_suggestion,
        ai_generate: p.ai_generate,
        ischange: p.ischange
      }
    }));
    paragraphs.sort((a: any, b: any) => a.order_index - b.order_index);
    return { chapter, paragraphs };
  },

  // 更新章节标题
  updateChapterTitle: async (chapterId: string, title: string): Promise<void> => {
    const response = await fetch(`/api/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error('Failed to update chapter title');
    }
  },

  // 更新章节状态
  updateChapterStatus: async (chapterId: string, status: string): Promise<void> => {
    const response = await fetch(`/api/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error('Failed to update chapter status');
    }
  },

  // 更新章节内容
  updateChapterContent: async (chapterId: string, paragraphs: any[]): Promise<void> => {
    const response = await fetch(`/api/v1/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paragraphs }),
    });
    if (!response.ok) {
      throw new Error('Failed to update chapter content');
    }
  },

  // 添加章节
  addChapter: async (documentId: string, title: string, parentId: string | null): Promise<Chapter> => {
    const response = await fetch('/api/chapters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        title: title.trim(),
        parent_id: parentId,
        order_index: 0,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to add chapter');
    }
    const data = await response.json();
    return data.data;
  },

  // 删除章节
  deleteChapter: async (chapterId: string): Promise<void> => {
    const response = await fetch(`/api/chapters/${chapterId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete chapter');
    }
  },

  // 获取章节目录
  getChapterToc: async (chapterId: string): Promise<any[]> => {
    const response = await fetch(`/api/v1/chapters/${chapterId}/toc`);
    if (!response.ok) {
      throw new Error('Failed to fetch chapter toc');
    }
    const data = await response.json();
    return data.data.toc || [];
  },

  // AI评估
  aiEvaluate: async (chapterId: string, data: any): Promise<any> => {
    const response = await fetch(`/api/chapters/${chapterId}/ai/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to evaluate chapter');
    }
    return await response.json();
  },

  // AI帮填
  aiAssist: async (chapterId: string, data: any): Promise<ReadableStream<Uint8Array>> => {
    const response = await fetch(`/api/chapters/${chapterId}/ai/assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to assist chapter');
    }
    return response.body as ReadableStream<Uint8Array>;
  },
};
