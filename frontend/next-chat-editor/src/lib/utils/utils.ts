// 生成唯一ID
export const generateId = (): string => {
  return 'b' + Date.now() + Math.floor(Math.random() * 1000);
};

// 处理流式响应
export const handleStreamingResponse = async (reader: ReadableStream<Uint8Array>, callback: (content: string) => void): Promise<string> => {
  let fullContent = '';
  let buffer = '';
  
  while (true) {
    const { done, value } = await (reader as any).read();
    if (done) break;
    
    // 解码并处理数据
    const chunk = new TextDecoder().decode(value);
    buffer += chunk;
    
    // 按行处理SSE格式
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6);
        // 检查是否是流结束消息
        if (jsonStr === '[DONE]') {
          continue;
        }
        try {
          const json = JSON.parse(jsonStr);
          if (json.content) {
            // 累加响应内容
            fullContent += json.content;
            callback(fullContent);
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e);
        }
      }
    }
  }
  
  // 处理最后一行
  if (buffer) {
    if (buffer.startsWith('data: ')) {
      const jsonStr = buffer.substring(6);
      // 检查是否是流结束消息
      if (jsonStr === '[DONE]') {
        // 流结束
      } else {
        try {
          const json = JSON.parse(jsonStr);
          if (json.content) {
            // 累加响应内容
            fullContent += json.content;
            callback(fullContent);
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e);
        }
      }
    }
  }
  
  return fullContent;
};

// 查找块
export const findBlockById = (blocks: any[], blockId: string): any => {
  for (const block of blocks) {
    if (block.id === blockId) {
      return block;
    }
    if (block.children && Array.isArray(block.children)) {
      const found = findBlockById(block.children, blockId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

// 递归查找并删除块
export const findAndDeleteBlock = (blocks: any[], blockId: string): boolean => {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === blockId) {
      blocks.splice(i, 1);
      return true;
    }
    const children = blocks[i].children;
    if (children && Array.isArray(children) && children.length > 0) {
      if (findAndDeleteBlock(children, blockId)) {
        return true;
      }
    }
  }
  return false;
};
