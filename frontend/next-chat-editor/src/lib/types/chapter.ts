import { Block } from './block';

export interface Chapter {
  chapter_id: string;
  document_id: string;
  parent_id: string | null;
  title: string;
  content: string | Block[];
  status: string;
  order_index: number;
  updated_at: string;
}
