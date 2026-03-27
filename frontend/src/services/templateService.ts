export interface Template {
  template_id: string;
  group_id: string;
  purpose: string;
  display_name: string;
  content: {
    description: string;
    default_prompt: string;
  };
  version: number;
  is_system: boolean;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  items: Template[];
}

export interface PurposeListResponse {
  purposes: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export const templateService = {
  // 获取模板列表
  async getTemplates(
    purpose?: string,
    is_system?: boolean,
    is_active?: boolean
  ): Promise<Template[]> {
    try {
      const params = new URLSearchParams();
      if (purpose) params.append('purpose', purpose);
      if (is_system !== undefined) params.append('is_system', is_system.toString());
      if (is_active !== undefined) params.append('is_active', is_active.toString());

      const response = await fetch(`${API_BASE_URL}/api/v1/templates?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      return data.data.items;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  },

  // 获取模板详情
  async getTemplate(templateId: string): Promise<Template | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  },

  // 获取所有模板用途
  async getPurposes(is_system: boolean = true): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/purposes/list?${new URLSearchParams({ is_system: is_system.toString() })}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch purposes');
      }

      const data = await response.json();
      return data.data.purposes;
    } catch (error) {
      console.error('Error fetching purposes:', error);
      return [];
    }
  },

  // 创建模板
  async createTemplate(
    purpose: string,
    display_name: string,
    content: { description: string; default_prompt: string },
    is_system: boolean = false,
    user_id: string | null = null
  ): Promise<Template | null> {
    try {
      const params = new URLSearchParams();
      params.append('purpose', purpose);
      params.append('display_name', display_name);
      params.append('content', JSON.stringify(content));
      params.append('is_system', is_system.toString());
      if (user_id) params.append('user_id', user_id);

      const response = await fetch(`${API_BASE_URL}/api/v1/templates?${params.toString()}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating template:', error);
      return null;
    }
  },

  // 更新模板
  async updateTemplate(
    templateId: string,
    updates: Partial<{
      purpose: string;
      display_name: string;
      content: { description: string; default_prompt: string };
      is_system: boolean;
      is_active: boolean;
    }>
  ): Promise<Template | null> {
    try {
      const params = new URLSearchParams();
      if (updates.purpose) params.append('purpose', updates.purpose);
      if (updates.display_name) params.append('display_name', updates.display_name);
      if (updates.content) params.append('content', JSON.stringify(updates.content));
      if (updates.is_system !== undefined) params.append('is_system', updates.is_system.toString());
      if (updates.is_active !== undefined) params.append('is_active', updates.is_active.toString());

      const response = await fetch(`${API_BASE_URL}/api/v1/templates/${templateId}?${params.toString()}`, {
        method: 'PUT',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating template:', error);
      return null;
    }
  },

  // 删除模板
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/${templateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  },

  // 回退模板
  async rollbackTemplate(templateId: string): Promise<Template | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/rollback/${templateId}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to rollback template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error rolling back template:', error);
      return null;
    }
  },
};
