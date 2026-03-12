import { Document, DocumentListResponse } from '../types/document';

export interface DocumentResponse {
  data: {
    document_id: string;
  };
}

export const createDocument = async (data: any): Promise<string> => {
  try {
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create document');
    }
    
    const result: DocumentResponse = await response.json();
    return result.data.document_id;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

export const fetchDocuments = async (page: number = 1, pageSize: number = 100): Promise<Document[]> => {
  try {
    const response = await fetch(`/api/documents?page=${page}&page_size=${pageSize}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    const result: DocumentListResponse = await response.json();
    return result.data.items;
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};
