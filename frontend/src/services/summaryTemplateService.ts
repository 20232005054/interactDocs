export interface SummaryTemplate {
  summary_template_id: string;
  template_id: string;
  title: string;
  generation_mode: number;
  content_template: string | null;
  sources: any[] | null;
  default_prompt: string | null;
  custom_prompt: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface SummaryTemplateCreate {
  template_id: string;
  title: string;
  generation_mode?: number;
  content_template?: string | null;
  sources?: any[] | null;
  default_prompt?: string | null;
  custom_prompt?: string | null;
  order_index?: number;
}

export interface SummaryTemplateUpdate {
  title?: string;
  generation_mode?: number;
  content_template?: string | null;
  sources?: any[] | null;
  default_prompt?: string | null;
  custom_prompt?: string | null;
  order_index?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const summaryTemplateService = {
  // 获取模板的摘要模板列表
  async getByTemplateId(templateId: string): Promise<SummaryTemplate[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/summary-templates/template/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch summary templates');
      }

      const data = await response.json();
      return data.data.items;
    } catch (error) {
      console.error('Error fetching summary templates:', error);
      return [];
    }
  },

  // 获取摘要模板详情
  async getById(summaryTemplateId: string): Promise<SummaryTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/summary-templates/${summaryTemplateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch summary template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching summary template:', error);
      return null;
    }
  },

  // 创建摘要模板
  async create(data: SummaryTemplateCreate): Promise<SummaryTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/summary-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create summary template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error creating summary template:', error);
      return null;
    }
  },

  // 更新摘要模板
  async update(summaryTemplateId: string, data: SummaryTemplateUpdate): Promise<SummaryTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/summary-templates/${summaryTemplateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update summary template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating summary template:', error);
      return null;
    }
  },

  // 删除摘要模板
  async delete(summaryTemplateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/summary-templates/${summaryTemplateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete summary template');
      }

      return true;
    } catch (error) {
      console.error('Error deleting summary template:', error);
      return false;
    }
  },
};
