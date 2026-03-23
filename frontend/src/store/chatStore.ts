import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: "apply" | "insert" | "replace";
  label: string;
  payload: string;
}

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastMessage: (content: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  clearMessages: () => void;
  addActionToLastMessage: (action: ChatAction) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isGenerating: false,
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
        },
      ],
    })),
  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1].content += content;
      }
      return { messages };
    }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  clearMessages: () => set({ messages: [] }),
  addActionToLastMessage: (action) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.actions = [...(lastMessage.actions || []), action];
      }
      return { messages };
    }),
}));
