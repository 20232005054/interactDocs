export interface StructureTemplate {
  structure_template_id: string;
  template_id: string;
  parent_id: string | null;
  title: string;
  level: number;
  generation_mode: number;
  content_template: string | null;
  sources: any[] | null;
  default_prompt: string | null;
  custom_prompt: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  children?: StructureTemplate[];
}

export interface StructureTemplateCreate {
  template_id: string;
  parent_id?: string | null;
  title: string;
  level: number;
  generation_mode?: number;
  content_template?: string | null;
  sources?: any[] | null;
  default_prompt?: string | null;
  custom_prompt?: string | null;
  order_index?: number;
}

export interface StructureTemplateUpdate {
  parent_id?: string | null;
  title?: string;
  level?: number;
  generation_mode?: number;
  content_template?: string | null;
  sources?: any[] | null;
  default_prompt?: string | null;
  custom_prompt?: string | null;
  order_index?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const structureTemplateService = {
  // 获取模板的结构模板列表
  async getByTemplateId(templateId: string): Promise<StructureTemplate[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates/template/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch structure templates');
      }

      const data = await response.json();
      return data.data.items;
    } catch (error) {
      console.error('Error fetching structure templates:', error);
      return [];
    }
  },

  // 获取模板的结构树
  async getStructureTree(templateId: string): Promise<StructureTemplate[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates/template/${templateId}/tree`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch structure tree');
      }

      const data = await response.json();
      return data.data.tree;
    } catch (error) {
      console.error('Error fetching structure tree:', error);
      return [];
    }
  },

  // 获取结构模板详情
  async getById(structureTemplateId: string): Promise<StructureTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates/${structureTemplateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch structure template');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching structure template:', error);
      return null;
    }
  },

  // 创建结构模板
  async create(data: StructureTemplateCreate): Promise<StructureTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create structure template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error creating structure template:', error);
      return null;
    }
  },

  // 更新结构模板
  async update(structureTemplateId: string, data: StructureTemplateUpdate): Promise<StructureTemplate | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates/${structureTemplateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update structure template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating structure template:', error);
      return null;
    }
  },

  // 删除结构模板
  async delete(structureTemplateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/structure-templates/${structureTemplateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete structure template');
      }

      return true;
    } catch (error) {
      console.error('Error deleting structure template:', error);
      return false;
    }
  },
};
