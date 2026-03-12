import { create } from 'zustand';
import { ChatMessage } from '../lib/types/message';
import { aiApi } from '../lib/api/aiApi';
import { chapterApi } from '../lib/api/chapterApi';
import { handleStreamingResponse } from '../lib/utils/utils';

interface AIState {
  // 状态
  chatMessages: ChatMessage[];
  aiMessage: string;
  aiMode: 'chat' | 'revision';
  loading: boolean;
  error: string | null;
  // 操作
  sendAIMessage: (message: string, documentId: string, selectedChapter: string | null, selectedParagraphs: any[]) => Promise<void>;
  handleAIEvaluate: (chapterId: string, document: any, selectedBlock: any) => Promise<void>;
  handleAIAssist: (chapterId: string, document: any, selectedBlock: any, updateChapterContent: (content: any) => Promise<void>) => Promise<void>;
  setAiMessage: (message: string) => void;
  setAiMode: (mode: 'chat' | 'revision') => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  // 初始状态
  chatMessages: [
    { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
  ],
  aiMessage: '',
  aiMode: 'chat',
  loading: false,
  error: null,

  // 发送AI消息
  sendAIMessage: async (message: string, documentId: string, selectedChapter: string | null, selectedParagraphs: any[]) => {
    if (!message.trim()) return;

    // 添加用户消息到聊天记录
    const newUserMessage: ChatMessage = { role: 'user', content: message };
    set((state) => ({
      chatMessages: [...state.chatMessages, newUserMessage],
      aiMessage: '',
      loading: true,
    }));

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    set((state) => ({
      chatMessages: [...state.chatMessages, { role: 'ai', content: '', id: aiMessageId }],
    }));

    try {
      const aiMode = get().aiMode;
      if (aiMode === 'chat') {
        // 调用Chat模式API，处理流式响应
        const reader = await aiApi.chat({
          message,
          document_id: documentId,
          selected_paragraphs: selectedParagraphs,
          selected_keywords: [],
          selected_summaries: []
        });

        if (reader) {
          await handleStreamingResponse(reader, (content) => {
            set((state) => ({
              chatMessages: state.chatMessages.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content } : msg
              ),
            }));
          });
        }
      } else {
        // 调用修订模式API
        const data = await aiApi.revision({
          document_id: documentId,
          chapter_id: selectedChapter,
          instruction: message,
          selected_paragraphs: selectedParagraphs
        });
        // 更新AI消息
        set((state) => ({
          chatMessages: state.chatMessages.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: data.data.content } : msg
          ),
        }));
      }
    } catch (error) {
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, content: '抱歉，我暂时无法处理您的请求，请稍后再试。' } : msg
        ),
        error: 'AI消息发送失败',
        loading: false,
      }));
      console.error('Error sending AI message:', error);
    } finally {
      set({ loading: false });
    }
  },

  // AI评估
  handleAIEvaluate: async (chapterId: string, document: any, selectedBlock: any) => {
    // 添加用户消息到聊天记录
    const newUserMessage: ChatMessage = { role: 'user', content: '请帮我AI评估该段落' };
    set((state) => ({
      chatMessages: [...state.chatMessages, newUserMessage],
      loading: true,
    }));

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    set((state) => ({
      chatMessages: [...state.chatMessages, { role: 'ai', content: '', id: aiMessageId }],
    }));

    try {
      const data = await chapterApi.aiEvaluate(chapterId, {
        document_title: document?.title || '',
        document_keywords: document?.keywords || [],
        paragraph_title: selectedBlock.type.startsWith('heading') ? selectedBlock.content : '',
        paragraph_content: selectedBlock.type === 'paragraph' ? selectedBlock.content : ''
      });

      // 组合评估内容和建议
      let evaluationContent = data.data.evaluation;
      if (data.data.suggestions && data.data.suggestions.length > 0) {
        evaluationContent += '\n\n### 改进建议\n\n';
        data.data.suggestions.forEach((suggestion: string, index: number) => {
          evaluationContent += `${index + 1}. ${suggestion}\n\n`;
        });
      }

      // 更新AI消息
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, content: evaluationContent } : msg
        ),
        loading: false,
      }));
    } catch (error) {
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, content: 'AI评估失败，请稍后再试' } : msg
        ),
        error: 'AI评估失败',
        loading: false,
      }));
      console.error('Error evaluating chapter:', error);
    }
  },

  // AI帮填
  handleAIAssist: async (chapterId: string, document: any, selectedBlock: any, updateChapterContent: (content: any) => Promise<void>) => {
    // 检查段落内容是否为空
    const isEmpty = selectedBlock.type === 'paragraph' ? !selectedBlock.content : selectedBlock.children?.length === 0;
    if (!isEmpty) {
      // 段落不为空，显示提示消息
      const newUserMessage: ChatMessage = { role: 'user', content: '帮我AI填写内容' };
      set((state) => ({
        chatMessages: [...state.chatMessages, newUserMessage],
      }));
      const aiMessageId = Date.now();
      set((state) => ({
        chatMessages: [...state.chatMessages, { role: 'ai', content: '段落不为空，不能AI帮填', id: aiMessageId }],
      }));
      return;
    }

    // 添加用户消息到聊天记录
    const newUserMessage: ChatMessage = { role: 'user', content: '帮我AI填写内容' };
    set((state) => ({
      chatMessages: [...state.chatMessages, newUserMessage],
      loading: true,
    }));

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    set((state) => ({
      chatMessages: [...state.chatMessages, { role: 'ai', content: '好的，现在帮你完成', id: aiMessageId }],
    }));

    try {
      const reader = await chapterApi.aiAssist(chapterId, {
        chapter_id: chapterId,
        document_title: document?.title || '',
        document_keywords: document?.keywords || [],
        paragraph_title: selectedBlock.type.startsWith('heading') ? selectedBlock.content : ''
      });

      if (reader) {
        let fullContent = '';
        await handleStreamingResponse(reader, (content) => {
          fullContent = content;
        });

        if (fullContent) {
          // 更新段落内容
          if (selectedBlock.type === 'paragraph') {
            selectedBlock.content = fullContent;
          } else if (selectedBlock.children) {
            selectedBlock.children.push({
              id: 'b' + Date.now() + Math.floor(Math.random() * 1000),
              type: 'paragraph',
              content: fullContent,
              metadata: {}
            });
          }
          // 自动保存章节内容
          await updateChapterContent(selectedBlock);
          // 更新AI消息
          set((state) => ({
            chatMessages: state.chatMessages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: '好的，现在帮你完成\n\n内容已自动保存' } : msg
            ),
            loading: false,
          }));
        }
      }
    } catch (error) {
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, content: `AI帮填失败: ${error instanceof Error ? error.message : '未知错误'}` } : msg
        ),
        error: 'AI帮填失败',
        loading: false,
      }));
      console.error('Error assisting chapter:', error);
    }
  },

  // 设置AI消息
  setAiMessage: (message: string) => {
    set({ aiMessage: message });
  },

  // 设置AI模式
  setAiMode: (mode: 'chat' | 'revision') => {
    set({ aiMode: mode });
  },

  // 设置错误
  setError: (error: string | null) => {
    set({ error });
  },

  // 清空消息
  clearMessages: () => {
    set({
      chatMessages: [
        { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
      ],
    });
  },
}));
