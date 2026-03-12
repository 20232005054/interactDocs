export interface Block {
  id: string;
  type: string;
  content?: string | object;
  items?: string[];
  children?: Block[];
  order_index?: number;
  metadata: {
    ai_eval?: string;
    ai_suggestion?: string;
    ai_generate?: string;
    [key: string]: any;
  };
}
