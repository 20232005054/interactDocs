import { create } from 'zustand';
import { Document } from '../lib/types/document';
import { Snapshot } from '../lib/types/snapshot';
import { documentApi } from '../lib/api/documentApi';
import { snapshotApi } from '../lib/api/snapshotApi';

interface DocumentState {
  // 状态
  document: Document | null;
  recentDocuments: Document[];
  snapshots: Snapshot[];
  loading: boolean;
  error: string | null;
  // 操作
  fetchDocument: (documentId: string) => Promise<void>;
  fetchRecentDocuments: () => Promise<void>;
  updateDocument: (documentId: string, updates: Partial<Document>) => Promise<void>;
  fetchSnapshots: (documentId: string) => Promise<void>;
  createSnapshot: (documentId: string, description: string) => Promise<void>;
  getDefaultSnapshotDescription: (documentId: string) => Promise<string>;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // 初始状态
  document: null,
  recentDocuments: [],
  snapshots: [],
  loading: false,
  error: null,

  // 获取文档信息
  fetchDocument: async (documentId: string) => {
    set({ loading: true, error: null });
    try {
      const document = await documentApi.getDocument(documentId);
      set({ document, loading: false });
    } catch (error) {
      set({ error: '获取文档信息失败', loading: false });
      console.error('Error fetching document:', error);
    }
  },

  // 获取最近文档
  fetchRecentDocuments: async () => {
    try {
      const recentDocuments = await documentApi.getRecentDocuments();
      set({ recentDocuments });
    } catch (error) {
      console.error('Error fetching recent documents:', error);
    }
  },

  // 更新文档信息
  updateDocument: async (documentId: string, updates: Partial<Document>) => {
    try {
      const updatedDocument = await documentApi.updateDocument(documentId, updates);
      set({ document: updatedDocument });
    } catch (error) {
      set({ error: '更新文档信息失败' });
      console.error('Error updating document:', error);
    }
  },

  // 获取快照列表
  fetchSnapshots: async (documentId: string) => {
    try {
      const snapshots = await snapshotApi.getSnapshots(documentId);
      set({ snapshots });
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    }
  },

  // 创建快照
  createSnapshot: async (documentId: string, description: string) => {
    try {
      await snapshotApi.createSnapshot(documentId, description);
      // 重新获取快照列表
      await get().fetchSnapshots(documentId);
    } catch (error) {
      set({ error: '创建快照失败' });
      console.error('Error creating snapshot:', error);
    }
  },

  // 获取默认快照描述
  getDefaultSnapshotDescription: async (documentId: string) => {
    try {
      return await snapshotApi.getDefaultSnapshotDescription(documentId);
    } catch (error) {
      console.error('Error fetching default snapshot description:', error);
      return '';
    }
  },

  // 设置错误
  setError: (error: string | null) => {
    set({ error });
  },
}));
