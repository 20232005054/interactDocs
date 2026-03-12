import { BatchSummaryRequest } from '../types/summary';

export const batchCreateSummaries = async (data: BatchSummaryRequest): Promise<void> => {
  try {
    const response = await fetch('/api/v1/summaries/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create summaries');
    }
  } catch (error) {
    console.error('Error creating summaries:', error);
    // 不抛出错误，允许继续执行
  }
};
