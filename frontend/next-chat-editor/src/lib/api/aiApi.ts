export const aiApi = {
  // AI聊天
  chat: async (data: any): Promise<ReadableStream<Uint8Array>> => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to send AI message');
    }
    return response.body as ReadableStream<Uint8Array>;
  },

  // AI修订
  revision: async (data: any): Promise<any> => {
    const response = await fetch('/api/ai/revision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to send AI message');
    }
    return await response.json();
  },
};
