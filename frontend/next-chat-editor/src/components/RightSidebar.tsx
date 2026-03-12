import React from 'react';
import { ChevronLeft, ChevronRight, Send, History } from 'lucide-react';
import { useAIStore } from '../store/aiStore';

interface RightSidebarProps {
  documentId: string;
  chapterId?: string;
  rightSidebarCollapsed?: boolean;
  setRightSidebarCollapsed?: (collapsed: boolean) => void;
  rightSidebarWidth?: number;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  documentId,
  chapterId,
  rightSidebarCollapsed = false,
  setRightSidebarCollapsed = () => {},
  rightSidebarWidth = 320
}) => {
  const {
    chatMessages,
    aiMessage,
    aiMode,
    loading,
    sendAIMessage,
    setAiMessage,
    setAiMode
  } = useAIStore();

  // 发送AI消息
  const handleSendMessage = () => {
    if (aiMessage.trim()) {
      sendAIMessage(aiMessage, documentId, chapterId || null, []);
    }
  };

  // 处理键盘回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div 
      className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ease-in-out`} 
      style={{ width: rightSidebarCollapsed ? '64px' : `${rightSidebarWidth}px`, transition: 'none' }} 
    >
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className={`flex items-center space-x-2 ${rightSidebarCollapsed ? 'hidden' : 'flex'}`}>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
            AI
          </div>
          <div>
            <h3 className="font-medium text-gray-900">AI助手</h3>
            <p className="text-xs text-gray-500">随时为您提供帮助</p>
          </div>
        </div>
        <button 
          className="text-gray-600 hover:text-gray-800"
          onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
        >
          {rightSidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* 聊天区域 */}
      {!rightSidebarCollapsed && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(100vh - 240px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* 隐藏滚动条 */}
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {chatMessages.map((message, index) => (
            message.role === 'ai' ? (
              <div key={index} className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold mr-2">
                  AI
                </div>
                <div className="bg-green-50 rounded-lg rounded-tl-none p-3 max-w-[80%]">
                  <div className="text-gray-800 text-sm">
                    {message.content}
                  </div>
                </div>
              </div>
            ) : (
              <div key={index} className="flex items-start justify-end">
                <div className="bg-blue-50 rounded-lg rounded-tr-none p-3 max-w-[80%]">
                  <div className="text-gray-800 text-sm">
                    {message.content}
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ml-2">
                  我
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="flex items-start">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold mr-2">
                AI
              </div>
              <div className="bg-green-50 rounded-lg rounded-tl-none p-3 max-w-[80%]">
                <div className="text-gray-800 text-sm">
                  <div className="animate-pulse">
                    <div className="h-2 bg-gray-300 rounded w-32 mb-2"></div>
                    <div className="h-2 bg-gray-300 rounded w-48 mb-2"></div>
                    <div className="h-2 bg-gray-300 rounded w-36"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 底部输入区域 */}
      {!rightSidebarCollapsed && (
        <div className="p-4 border-t border-gray-200">
          {/* 模式切换 */}
          <div className="flex mb-3 space-x-2">
            <button 
              className={`flex-1 py-1 text-center text-xs font-medium rounded-md ${aiMode === 'chat' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
              onClick={() => setAiMode('chat')}
            >
              聊天模式
            </button>
            <button 
              className={`flex-1 py-1 text-center text-xs font-medium rounded-md ${aiMode === 'revision' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
              onClick={() => setAiMode('revision')}
            >
              修订模式
            </button>
          </div>
          
          {/* 输入框 */}
          <div className="flex items-center space-x-2">
            <button className="text-gray-500 hover:text-gray-700">
              <History size={16} />
            </button>
            <input
              type="text"
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={aiMode === 'chat' ? "请输入您的问题..." : "请输入修订指令..."}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            />
            <button 
              className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
              onClick={handleSendMessage}
              disabled={!aiMessage.trim() || loading}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
