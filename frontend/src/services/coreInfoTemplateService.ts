export interface CoreInfoTemplate {
  core_template_id: string;
  template_id: string;
  field_name: string;
  field_key: string;
  field_type: string;
  default_value: string | null;
  options: any[] | null;
  is_required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CoreInfoTemplateCreate {
  template_id: string;
  field_name: string;
  field_key: string;
  field_type: string;
  default_value?: string | null;
  options?: any[] | null;
  is_required?: boolean;
  order_index?: number;
}

export interface CoreInfoTemplateUpdate {
  field_name?: string;
  field_key?: string;
  field_type?: string;
  default_value?: string | null;
  options?: any[] | null;
  is_required?: boolean;
  order_index?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const coreInfoTemplateService = {
  // 获取模板的核心信息字段列表
  async getByTemplateId(templateId: string): Promise<CoreInfoTemplate[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/core-info-templates/template/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch core info templates');
      }

      const data = await response.json();
      return data.data.items;
    } catch (error) {
      console.error('Error fetching core info templates:', error);
      return [];
    }
  },

  // 获取核心信息模板详情
  async getById(coreTemplateId: string): Promise<CoreInfoTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/core-info-templates/${coreTemplateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch core info template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching core info template:', error);
      return null;
    }
  },

  // 创建核心信息模板
  async create(data: CoreInfoTemplateCreate): Promise<CoreInfoTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/core-info-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create core info template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error creating core info template:', error);
      return null;
    }
  },

  // 更新核心信息模板
  async update(coreTemplateId: string, data: CoreInfoTemplateUpdate): Promise<CoreInfoTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/core-info-templates/${coreTemplateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update core info template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating core info template:', error);
      return null;
    }
  },

  // 删除核心信息模板
  async delete(coreTemplateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/core-info-templates/${coreTemplateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete core info template');
      }

      return true;
    } catch (error) {
      console.error('Error deleting core info template:', error);
      return false;
    }
  },
};
