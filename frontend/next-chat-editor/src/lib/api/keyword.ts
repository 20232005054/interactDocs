import { BatchKeywordRequest } from '../types/keyword';

export const batchCreateKeywords = async (data: BatchKeywordRequest): Promise<void> => {
  try {
    const response = await fetch('/api/v1/keywords/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create keywords');
    }
  } catch (error) {
    console.error('Error creating keywords:', error);
    // 不抛出错误，允许继续执行
  }
};
