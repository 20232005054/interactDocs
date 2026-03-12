import { Metadata } from '../types/form';

export interface MetadataResponse {
  data: Metadata;
}

export const fetchMetadata = async (): Promise<Metadata> => {
  try {
    const response = await fetch('/api/metadata/generate', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }
    
    const data: MetadataResponse = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    // 返回默认元数据
    return {
      generateType: "scheme_gc",
      title: "方案生成",
      fields: [
        {
          field: "title",
          label: "方案标题",
          type: "input",
          required: true
        },
        {
          field: "content",
          label: "参考正文",
          type: "textarea",
          required: false
        },
        {
          field: "purpose",
          label: "使用目的",
          type: "select",
          options: ["申报", "临床", "总结", "其他"],
          required: true
        }
      ]
    };
  }
};
