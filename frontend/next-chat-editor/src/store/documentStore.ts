import { create } from 'zustand';
import { Document } from '../lib/types/document';
import { fetchDocuments as fetchDocumentsApi, createDocument as createDocumentApi } from '../lib/api/document';

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentDocument: (document: Document | null) => void;
  fetchDocuments: (page?: number, pageSize?: number) => Promise<void>;
  createDocument: (title: string) => Promise<Document>;
  updateDocument: (id: string, data: Partial<Document>) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,
  
  setCurrentDocument: (document) => set({ currentDocument: document }),
  
  fetchDocuments: async (page = 1, pageSize = 100) => {
    set({ isLoading: true, error: null });
    try {
      const documents = await fetchDocumentsApi(page, pageSize);
      set({ documents, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch documents', isLoading: false });
    }
  },
  
  createDocument: async (title) => {
    set({ isLoading: true, error: null });
    try {
      const documentId = await createDocumentApi({ title });
      // 重新获取文档列表以获取完整的文档信息
      const documents = await fetchDocumentsApi();
      const newDocument = documents.find(doc => doc.document_id === documentId);
      set((state) => ({
        documents,
        currentDocument: newDocument || null,
        isLoading: false,
      }));
      return newDocument as Document;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create document', isLoading: false });
      throw error;
    }
  },
  
  updateDocument: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update document');
      const updatedDocument = await response.json();
      set((state) => ({
        documents: state.documents.map(doc => doc.document_id === id ? updatedDocument : doc),
        currentDocument: state.currentDocument?.document_id === id ? updatedDocument : state.currentDocument,
        isLoading: false,
      }));
      return updatedDocument;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update document', isLoading: false });
      throw error;
    }
  },
  
  deleteDocument: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      set((state) => ({
        documents: state.documents.filter(doc => doc.document_id !== id),
        currentDocument: state.currentDocument?.document_id === id ? null : state.currentDocument,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete document', isLoading: false });
      throw error;
    }
  },
}));
