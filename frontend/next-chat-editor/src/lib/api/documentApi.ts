import { Document } from '../types/document';

export const documentApi = {
  // 获取文档信息
  getDocument: async (documentId: string): Promise<Document> => {
    const response = await fetch(`/api/documents/${documentId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }
    const data = await response.json();
    return data.data;
  },

  // 更新文档信息
  updateDocument: async (documentId: string, updates: Partial<Document>): Promise<Document> => {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update document');
    }
    const data = await response.json();
    return data.data;
  },

  // 获取最近文档
  getRecentDocuments: async (): Promise<Document[]> => {
    const response = await fetch('/api/documents?page=1&page_size=5');
    if (!response.ok) {
      throw new Error('Failed to fetch recent documents');
    }
    const data = await response.json();
    return data.data.items;
  },
};
