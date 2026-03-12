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
