import { Template, TemplatePurposesResponse, TemplateResponse } from '../types/template';

export const fetchTemplatePurposes = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/v1/templates/purposes/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data: TemplatePurposesResponse = await response.json();
      return data.data.purposes || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching template purposes:', error);
    return [];
  }
};

export const fetchTemplatesByPurpose = async (purpose: string): Promise<Template[]> => {
  try {
    const response = await fetch(`/api/v1/templates/by-purpose/${purpose}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data: TemplateResponse = await response.json();
      return data.data.items || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching templates by purpose:', error);
    return [];
  }
};
