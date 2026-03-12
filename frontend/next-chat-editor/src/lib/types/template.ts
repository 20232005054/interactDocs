export interface Template {
  template_id: string;
  display_name: string;
  purpose: string;
}

export interface TemplatePurpose {
  purpose: string;
  name: string;
}

export interface TemplateResponse {
  data: {
    items: Template[];
  };
}

export interface TemplatePurposesResponse {
  data: {
    purposes: string[];
  };
}
