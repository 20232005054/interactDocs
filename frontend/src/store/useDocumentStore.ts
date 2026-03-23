import { create } from 'zustand';

interface Document {
  id: string;
  title: string;
  content: string;
  purpose: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentStore {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  setDocuments: (documents: Document[]) => void;
  setCurrentDocument: (document: Document | null) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,
  setDocuments: (documents) => set({ documents }),
  setCurrentDocument: (currentDocument) => set({ currentDocument }),
  addDocument: (document) => set((state) => ({
    documents: [...state.documents, document]
  })),
  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map(doc => 
      doc.id === id ? { ...doc, ...updates, updatedAt: new Date().toISOString() } : doc
    ),
    currentDocument: state.currentDocument?.id === id 
      ? { ...state.currentDocument, ...updates, updatedAt: new Date().toISOString() } 
      : state.currentDocument
  })),
  deleteDocument: (id) => set((state) => ({
    documents: state.documents.filter(doc => doc.id !== id),
    currentDocument: state.currentDocument?.id === id ? null : state.currentDocument
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
