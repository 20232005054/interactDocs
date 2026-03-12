export interface Document {
  document_id: string;
  user_id: string;
  title: string;
  keywords: string[];
  abstract: string | null;
  content: string | null;
  purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  template_id?: string | null;
}

export interface DocumentListResponse {
  data: {
    items: Document[];
    total: number;
    page: number;
    page_size: number;
  };
}
