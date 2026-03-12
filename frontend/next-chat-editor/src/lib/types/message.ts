export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  id?: number;
}
