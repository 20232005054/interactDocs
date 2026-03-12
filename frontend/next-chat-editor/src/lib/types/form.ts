export interface Field {
  field: string;
  label: string;
  type: 'input' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

export interface Metadata {
  generateType: string;
  title: string;
  fields: Field[];
}

export interface FormData {
  [key: string]: string;
}

export interface Summary {
  title: string;
  content: string;
}
