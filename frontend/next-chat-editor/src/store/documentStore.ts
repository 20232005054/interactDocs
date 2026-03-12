import { create } from 'zustand';

interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  template_id: string | null;
}

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentDocument: (document: Document | null) => void;
  fetchDocuments: () => Promise<void>;
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
  
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      set({ documents: data, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch documents', isLoading: false });
    }
  },
  
  createDocument: async (title) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('Failed to create document');
      const newDocument = await response.json();
      set((state) => ({
        documents: [...state.documents, newDocument],
        currentDocument: newDocument,
        isLoading: false,
      }));
      return newDocument;
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
        documents: state.documents.map(doc => doc.id === id ? updatedDocument : doc),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
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
        documents: state.documents.filter(doc => doc.id !== id),
        currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete document', isLoading: false });
      throw error;
    }
  },
}));
