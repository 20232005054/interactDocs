import React, { useState, useEffect, useRef } from 'react';
import { Check, Plus, Trash2, Edit3, RefreshCw, Send, History } from 'lucide-react';
import { useChapterStore } from '../store/chapterStore';

interface Block {
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

interface ChapterEditorProps {
  documentId: string;
  chapterId: string;
  documentTitle: string;
  documentKeywords: string[];
}

export default function ChapterEditor({ documentId, chapterId, documentTitle, documentKeywords }: ChapterEditorProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiMode, setAiMode] = useState<'chat' | 'revision'>('chat');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string, id?: number, isRevision?: boolean, paragraphId?: string}>>([
    { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
  ]);
  
  const {
    chapterContent,
    selectedBlockId,
    selectedBlockType,
    hoveredBlockId,
    showAIAssistant,
    activeAIBlockId,
    selectedKeywords,
    selectedSummaries,
    selectedParagraphs,
    summaries,
    loading,
    error,
    selectChapter,
    addNewParagraph,
    addNextParagraph,
    deleteBlock,
    saveInlineEdit,
    setSelectedBlockId,
    setSelectedBlockType,
    setHoveredBlockId,
    setShowAIAssistant,
    setActiveAIBlockId,
    setSelectedKeywords,
    setSelectedSummaries,
    setSelectedParagraphs,
    handleAIEvaluate,
    handleAIAssist,
    generateFullContent
  } = useChapterStore();

  // 加载章节详情
  useEffect(() => {
    if (chapterId) {
      selectChapter(chapterId);
    }
  }, [chapterId, selectChapter]);

  // 开始内联编辑
  const startInlineEdit = (block: Block) => {
    setEditingBlockId(block.id);
    if (block.type === 'list') {
      setEditingValue(block.items?.join('\n') || '');
    } else {
      setEditingValue(typeof block.content === 'string' ? block.content : '');
    }
    
    // 保存当前块的引用
    const currentBlockId = block.id;
    
    // 延迟设置textarea高度，确保DOM已经更新
    setTimeout(() => {
      const editBlock = window.document.getElementById(currentBlockId);
      if (editBlock) {
        const textarea = editBlock.querySelector('textarea');
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
        
        // 滚动到编辑区中央
        editBlock.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 0);
    
    // 添加点击外部自动保存的事件监听器
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const editBlock = window.document.getElementById(currentBlockId);
      
      // 检查点击目标是否在编辑块外部
      if (editBlock && !editBlock.contains(target)) {
        // 确保不是点击了操作按钮
        const isActionButton = target.closest('button');
        if (!isActionButton) {
          // 检查当前是否仍在编辑模式
          if (editingBlockId === currentBlockId) {
            saveInlineEdit(block);
          }
        }
      }
    };
    
    // 添加按Esc键取消编辑的事件监听器
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // 检查当前是否仍在编辑模式
        if (editingBlockId === currentBlockId) {
          cancelInlineEdit();
        }
      }
    };
    
    // 使用捕获阶段来确保事件被正确捕获
    window.document.addEventListener('click', handleClickOutside, true);
    window.document.addEventListener('keydown', handleKeyDown, true);
    
    // 保存监听器引用，以便后续移除
    (window as any).editEventListeners = {
      click: handleClickOutside,
      keydown: handleKeyDown
    };
  };

  // 取消内联编辑
  const cancelInlineEdit = () => {
    // 重置编辑状态
    setEditingBlockId(null);
    setEditingValue('');
    
    // 移除事件监听器
    if ((window as any).editEventListeners) {
      window.document.removeEventListener('click', (window as any).editEventListeners.click, true);
      window.document.removeEventListener('keydown', (window as any).editEventListeners.keydown, true);
      (window as any).editEventListeners = null;
    }
    
    // 重置hover状态
    setHoveredBlockId(null);
  };

  // 选择段落时更新类型
  const handleSelectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    if (Array.isArray(chapterContent)) {
      const findBlockById = (blocks: Block[], id: string): Block | null => {
        for (const block of blocks) {
          if (block.id === id) {
            return block;
          }
          if (block.children && Array.isArray(block.children)) {
            const found = findBlockById(block.children, id);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };
      const block = findBlockById(chapterContent, blockId);
      if (block) {
        setSelectedBlockType(block.type);
      }
    }
  };
  
  // 全局点击事件监听器，用于处理点击段落外部的情况
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 检查点击目标是否在段落外部
      const isParagraph = target.closest('.block-element');
      const isActionButton = target.closest('button');
      const isStyleSelector = target.closest('.sticky');
      const isAIAssistant = target.closest('.mt-2.p-4.bg-white.border.border-gray-200.rounded-md.shadow-md');
      
      // 如果点击的不是段落、操作按钮或样式选择器，则重置selectedBlockId
      if (!isParagraph && !isActionButton && !isStyleSelector) {
        setSelectedBlockId(null);
      }
      
      // 如果点击的不是AI助手弹框，则关闭弹框
      if (!isAIAssistant && !isActionButton) {
        setShowAIAssistant(false);
        setActiveAIBlockId(null);
      }
    };
    
    // 添加全局点击事件监听器
    window.document.addEventListener('click', handleGlobalClick, true);
    
    // 清理事件监听器
    return () => {
      window.document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  // 处理AI评估
  const handleAIEvaluateClick = async () => {
    if (!chapterId || !selectedBlockId) return;

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: '请帮我AI评估该段落' };
    setChatMessages(prev => [...prev, newUserMessage]);

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '', id: aiMessageId }]);

    // 调用AI评估
    const evaluationContent = await handleAIEvaluate(chapterId, selectedBlockId, documentTitle, documentKeywords);
    
    // 更新AI消息
    setChatMessages(prev => prev.map(msg => 
      msg.id === aiMessageId ? { ...msg, content: evaluationContent } : msg
    ));
  };

  // 处理AI帮填
  const handleAIAssistClick = async () => {
    if (!chapterId || !selectedBlockId) return;

    // 检查段落内容是否为空
    if (Array.isArray(chapterContent)) {
      const findBlockById = (blocks: Block[], id: string): Block | null => {
        for (const block of blocks) {
          if (block.id === id) {
            return block;
          }
          if (block.children && Array.isArray(block.children)) {
            const found = findBlockById(block.children, id);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };
      const selectedBlock = findBlockById(chapterContent, selectedBlockId);
      if (selectedBlock) {
        const isEmpty = selectedBlock.type === 'paragraph' ? !selectedBlock.content : selectedBlock.children?.length === 0;
        if (!isEmpty) {
          // 段落不为空，显示提示消息
          const newUserMessage = { role: 'user' as const, content: '帮我AI填写内容' };
          setChatMessages(prev => [...prev, newUserMessage]);
          const aiMessageId = Date.now();
          setChatMessages(prev => [...prev, { role: 'ai' as const, content: '段落不为空，不能AI帮填', id: aiMessageId }]);
          return;
        }
      }
    }

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: '帮我AI填写内容' };
    setChatMessages(prev => [...prev, newUserMessage]);

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '好的，现在帮你完成', id: aiMessageId }]);

    // 调用AI帮填
    const assistContent = await handleAIAssist(chapterId, selectedBlockId, selectedSummaries);
    
    // 更新AI消息
    setChatMessages(prev => prev.map(msg => 
      msg.id === aiMessageId ? { ...msg, content: assistContent } : msg
    ));
  };

  // 发送AI消息
  const sendAIMessage = async () => {
    if (!aiMessage.trim() || !chapterId) return;

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: aiMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setAiMessage('');

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '', id: aiMessageId }]);

    try {
      if (aiMode === 'chat') {
        // 构建selected_paragraphs - 只包含选中的段落
        const selectedParagraphList = Array.isArray(chapterContent) ? Array.from(selectedParagraphs).map(blockId => {
          const findBlockById = (blocks: Block[], id: string): Block | null => {
            for (const block of blocks) {
              if (block.id === id) {
                return block;
              }
              if (block.children && Array.isArray(block.children)) {
                const found = findBlockById(block.children, id);
                if (found) {
                  return found;
                }
              }
            }
            return null;
          };
          const block = findBlockById(chapterContent, blockId);
          return {
            paragraph_id: blockId,
            content: block && typeof block.content === 'string' ? block.content : ''
          };
        }).filter(item => item.content) : [];

        // 构建selected_keywords
        const formattedSelectedKeywords = documentKeywords ? documentKeywords.filter(keyword => selectedKeywords.includes(keyword)).map(keyword => ({
          keyword_id: `keyword_${keyword}`,
          keyword: keyword
        })) : [];

        // 构建selected_summaries
        const formattedSelectedSummaries = summaries.filter(summary => selectedSummaries.includes(summary.summary_id)).map(summary => ({
          summary_id: summary.summary_id,
          title: summary.title,
          content: summary.content
        }));

        // 调用Chat模式API，处理流式响应
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
          message: aiMessage,
          document_id: documentId,
          selected_paragraphs: selectedParagraphList,
          selected_keywords: formattedSelectedKeywords,
          selected_summaries: formattedSelectedSummaries
        }),
        });

        if (!response.ok) {
          throw new Error('Failed to send AI message');
        }

        // 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        let fullResponse = '';
        let buffer = '';
        while (true) {
          const { done, value } = await (reader as any).read();
          if (done) break;
          
          // 解码并处理数据
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;
          
          // 按行处理SSE格式
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.substring(6);
              // 检查是否是流结束消息
              if (jsonStr === '[DONE]') {
                continue;
              }
              try {
                const json = JSON.parse(jsonStr);
                if (json.response) {
                  // 累加响应内容，而不是替换
                  fullResponse += json.response;
                  // 更新AI消息
                  setChatMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId ? { ...msg, content: fullResponse } : msg
                  ));
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e);
              }
            }
          }
        }
        
        // 处理最后一行
        if (buffer) {
          if (buffer.startsWith('data: ')) {
            const jsonStr = buffer.substring(6);
            // 检查是否是流结束消息
            if (jsonStr === '[DONE]') {
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              if (json.response) {
                // 累加响应内容，而不是替换
                fullResponse += json.response;
                // 更新AI消息
                setChatMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId ? { ...msg, content: fullResponse } : msg
                ));
              }
            } catch (e) {
              console.error('Error parsing streaming response:', e);
            }
          }
        }
      } else {
        // 构建selected_paragraphs - 只包含选中的段落
        const selectedParagraphList = Array.isArray(chapterContent) ? Array.from(selectedParagraphs).map(blockId => {
          const findBlockById = (blocks: Block[], id: string): Block | null => {
            for (const block of blocks) {
              if (block.id === id) {
                return block;
              }
              if (block.children && Array.isArray(block.children)) {
                const found = findBlockById(block.children, id);
                if (found) {
                  return found;
                }
              }
            }
            return null;
          };
          const block = findBlockById(chapterContent, blockId);
          return {
            paragraph_id: blockId,
            content: block && typeof block.content === 'string' ? block.content : ''
          };
        }).filter(item => item.content) : [];

        // 调用修订模式API
        const response = await fetch('/api/v1/ai/revision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: documentId,
            chapter_id: chapterId,
            instruction: aiMessage,
            selected_paragraphs: selectedParagraphList
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send AI message');
        }

        const data = await response.json();
        
        // 处理修订内容，从数组中提取
        let revisedContent = '';
        if (Array.isArray(data.data.content)) {
          // 如果是数组，提取第一个元素的content
          if (data.data.content.length > 0 && data.data.content[0].content) {
            revisedContent = data.data.content[0].content;
          }
        } else if (typeof data.data.content === 'string') {
          // 如果是字符串，直接使用
          revisedContent = data.data.content;
        }
        
        // 获取选中的段落ID
        const selectedBlockId = Array.from(selectedParagraphs)[0];
        
        // 更新AI消息，添加应用按钮
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { 
            ...msg, 
            content: revisedContent,
            isRevision: true,
            paragraphId: selectedBlockId
          } : msg
        ));
      }
    } catch (err) {
      console.error('Error sending AI message:', err);
      // 更新错误消息
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: '抱歉，我暂时无法处理您的请求，请稍后再试。' } : msg
      ));
    }
  };

  // 应用修订内容
  const applyRevision = async (paragraphId: string, revisedContent: string) => {
    if (!Array.isArray(chapterContent)) return;

    const findBlockById = (blocks: Block[], id: string): Block | null => {
      for (const block of blocks) {
        if (block.id === id) {
          return block;
        }
        if (block.children && Array.isArray(block.children)) {
          const found = findBlockById(block.children, id);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const block = findBlockById(chapterContent, paragraphId);
    if (block) {
      try {
        // 更新段落内容
        const response = await fetch(`/api/v1/paragraphs/${paragraphId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: revisedContent,
            para_type: block.type,
            order_index: block.order_index || 0
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update paragraph');
        }
        
        // 更新本地状态
        block.content = revisedContent;
        // 由于我们不能直接更新store中的chapterContent，这里我们通过saveInlineEdit来保存
        saveInlineEdit(block);
      } catch (err) {
        console.error('Error applying revision:', err);
      }
    }
  };

  // 渲染Block内容
  const renderBlockContent = (block: Block) => {
    // 编辑模式
    if (editingBlockId === block.id) {
      return (
        <div key={block.id} id={block.id} className="mb-4">
          <div className="p-4 border border-gray-200 rounded-md relative">
            <div className="flex flex-col">
              {block.type === 'list' ? (
                <textarea
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => saveInlineEdit(block)}
                  onInput={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="请输入列表项，每行一项..."
                  style={{ minHeight: '100px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                  autoFocus
                />
              ) : block.type.startsWith('heading') ? (
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => saveInlineEdit(block)}
                  className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 ${block.type === 'heading-1' ? 'text-2xl font-bold' : block.type === 'heading-2' ? 'text-xl font-bold' : 'text-lg font-bold'}`}
                  autoFocus
                />
              ) : (
                <textarea
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => saveInlineEdit(block)}
                  onInput={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="请输入内容..."
                  style={{ minHeight: '80px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                  autoFocus
                />
              )}

            </div>
            {block.children && Array.isArray(block.children) && block.children.length > 0 && (
              <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-4">
                {block.children.map((childBlock) => 
                  renderBlockContent(childBlock)
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 正常模式
    let contentElement;
    switch (block.type) {
      case 'heading-1':
        contentElement = (
          <h1 
            id={block.id}
            className="text-2xl font-bold text-gray-900 cursor-text break-words"
            style={{ 
              minHeight: '24px',
              padding: '4px 0'
            }}
            onClick={() => {
              handleSelectBlock(block.id);
              startInlineEdit(block);
            }}
          >
            {typeof block.content === 'string' ? block.content || <span className="text-gray-400">点击此处编辑...</span> : <span className="text-gray-400">点击此处编辑...</span>}
          </h1>
        );
        break;
      case 'heading-2':
        contentElement = (
          <h2 
            id={block.id}
            className="text-xl font-bold text-gray-900 cursor-text break-words"
            style={{ 
              minHeight: '24px',
              padding: '4px 0'
            }}
            onClick={() => {
              handleSelectBlock(block.id);
              startInlineEdit(block);
            }}
          >
            {typeof block.content === 'string' ? block.content || <span className="text-gray-400">点击此处编辑...</span> : <span className="text-gray-400">点击此处编辑...</span>}
          </h2>
        );
        break;
      case 'heading-3':
        contentElement = (
          <h3 
            id={block.id}
            className="text-lg font-bold text-gray-900 cursor-text break-words"
            style={{ 
              minHeight: '24px',
              padding: '4px 0'
            }}
            onClick={() => {
              handleSelectBlock(block.id);
              startInlineEdit(block);
            }}
          >
            {typeof block.content === 'string' ? block.content || <span className="text-gray-400">点击此处编辑...</span> : <span className="text-gray-400">点击此处编辑...</span>}
          </h3>
        );
        break;
      case 'paragraph':
        contentElement = (
          <p 
            className={`text-gray-800 cursor-pointer break-words ${selectedBlockId === block.id ? 'bg-green-50' : ''}`}
            style={{ 
              whiteSpace: 'pre-line',
              minHeight: '24px',
              padding: '4px 0'
            }}
            onClick={() => {
              handleSelectBlock(block.id);
              startInlineEdit(block);
            }}
          >
            {typeof block.content === 'string' ? block.content || <span className="text-gray-400">点击此处编辑...</span> : <span className="text-gray-400">点击此处编辑...</span>}
          </p>
        );
        break;
      case 'list':
        contentElement = (
          <ul className={`list-disc pl-5 space-y-1 text-gray-800 ${selectedBlockId === block.id ? 'bg-green-50' : ''}`}>
            {block.items?.map((item, i) => (
              <li 
                key={i} 
                className="cursor-pointer"
                onClick={() => {
                  handleSelectBlock(block.id);
                  startInlineEdit(block);
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        );
        break;
      default:
        contentElement = (
          <div 
            className="text-gray-800 cursor-text"
            onClick={() => startInlineEdit(block)}
          >
            {JSON.stringify(block)}
          </div>
        );
        break;
    }

    return (
      <div 
        key={block.id} 
        id={block.id} 
        className={`mb-4 flex items-center block-element ${selectedParagraphs.has(block.id) ? 'bg-green-50 border-green-300' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', block.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedBlockId = e.dataTransfer.getData('text/plain');
          if (draggedBlockId !== block.id) {
            // 实现拖动排序逻辑
            const moveBlock = (blocks: Block[], fromId: string, toId: string) => {
              const newBlocks = [...blocks];
              let draggedBlock: Block | null = null;
              let draggedIndex = -1;
              let targetIndex = -1;

              // 查找拖动的块和目标块
              for (let i = 0; i < newBlocks.length; i++) {
                if (newBlocks[i].id === fromId) {
                  draggedBlock = newBlocks[i];
                  draggedIndex = i;
                } else if (newBlocks[i].id === toId) {
                  targetIndex = i;
                }

                // 检查子块
                if (newBlocks[i].children && Array.isArray(newBlocks[i].children)) {
                  const result = moveBlock(newBlocks[i].children as Block[], fromId, toId);
                  if (result) {
                    return true;
                  }
                }
              }

              // 如果找到了拖动的块和目标块，执行移动
              if (draggedBlock && draggedIndex !== -1 && targetIndex !== -1) {
                const originalOrderIndex = draggedBlock.order_index || 0;
                
                // 从原位置移除拖动的块
                newBlocks.splice(draggedIndex, 1);
                // 在目标位置插入拖动的块
                newBlocks.splice(targetIndex, 0, draggedBlock);
                
                // 更新所有段落的order_index
                newBlocks.forEach((block, index) => {
                  block.order_index = index;
                });
                
                // 使用批量更新接口更新段落顺序
                if (chapterId) {
                  const paragraphOrders = newBlocks.map(block => ({
                    paragraph_id: block.id,
                    order_index: block.order_index
                  }));
                  
                  fetch(`/api/v1/chapters/${chapterId}/paragraphs/order`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ paragraph_orders: paragraphOrders }),
                  }).catch(err => {
                    console.error('Error updating paragraph order:', err);
                  });
                }
                
                return true;
              }

              return false;
            };

            moveBlock(chapterContent as Block[], draggedBlockId, block.id);
          }
        }}
        onMouseEnter={() => {
          // 只有在非编辑模式下才设置hoveredBlockId
          if (editingBlockId !== block.id) {
            setHoveredBlockId(block.id);
          }
        }}
        onMouseLeave={() => setHoveredBlockId(null)}
      >
        {/* 左侧点击选择区域 */}
        <div 
          className="w-8 h-8 flex items-center justify-center mr-2 cursor-pointer"
          onClick={() => {
            setSelectedParagraphs(new Set(Array.from(selectedParagraphs).includes(block.id) ? Array.from(selectedParagraphs).filter(id => id !== block.id) : [...Array.from(selectedParagraphs), block.id]));
          }}
        >
          {selectedParagraphs.has(block.id) && (
            <Check size={18} className="text-green-500" />
          )}
        </div>
        
        {/* 拖动手柄 */}
        <div 
          className="mr-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          title="拖动调整顺序"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 3C4.55229 3 5 3.44772 5 4V5C5 5.55229 4.55229 6 4 6C3.44772 6 3 5.55229 3 5V4C3 3.44772 3.44772 3 4 3Z" fill="currentColor"/>
            <path d="M4 8C4.55229 8 5 8.44772 5 9V10C5 10.5523 4.55229 11 4 11C3.44772 11 3 10.5523 3 10V9C3 8.44772 3.44772 8 4 8Z" fill="currentColor"/>
            <path d="M4 13C4.55229 13 5 13.4477 5 14C5 14.5523 4.55229 15 4 15C3.44772 15 3 14.5523 3 14C3 13.4477 3.44772 13 4 13Z" fill="currentColor"/>
            <path d="M12 3C12.5523 3 13 3.44772 13 4V5C13 5.55229 12.5523 6 12 6C11.4477 6 11 5.55229 11 5V4C11 3.44772 11.4477 3 12 3Z" fill="currentColor"/>
            <path d="M12 8C12.5523 8 13 8.44772 13 9V10C13 10.5523 12.5523 11 12 11C11.4477 11 11 10.5523 11 10V9C11 8.44772 11.4477 8 12 8Z" fill="currentColor"/>
            <path d="M12 13C12.5523 13 13 13.4477 13 14C13 14.5523 12.5523 15 12 15C11.4477 15 11 14.5523 11 14C11 13.4477 11.4477 13 12 13Z" fill="currentColor"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="p-4 border border-gray-200 rounded-md">
            <div className="flex justify-between items-start">
              <div className="flex-1">
              {contentElement}
            </div>
            </div>
            {block.children && Array.isArray(block.children) && block.children.length > 0 && (
                <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-4">
                  {block.children.map((childBlock) => 
                    renderBlockContent(childBlock)
                  )}
                </div>
              )}
          </div>
          {/* AI助手弹框 */}
          {showAIAssistant && activeAIBlockId === block.id && (
            <div className="mt-2 p-4 bg-white border border-gray-200 rounded-md shadow-md">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-gray-700">AI助手</h4>
                <button 
                  className="text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIAssistant(false);
                    setActiveAIBlockId(null);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {/* 选择关键词 */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-600 mb-2">选择关键词</h5>
                  <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {documentKeywords && documentKeywords.length > 0 ? (
                      documentKeywords.map((keyword, index) => (
                        <div key={index} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            id={`keyword-${index}`}
                            checked={selectedKeywords.includes(keyword)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKeywords([...selectedKeywords, keyword]);
                              } else {
                                setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
                              }
                            }}
                            className="mr-2"
                          />
                          <label htmlFor={`keyword-${index}`} className="text-xs text-gray-700">{keyword}</label>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">暂无关键词</div>
                    )}
                  </div>
                </div>
                
                {/* 选择摘要 */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-600 mb-2">选择摘要</h5>
                  <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {summaries.length > 0 ? (
                      summaries.map((summary) => (
                        <div key={summary.summary_id} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            id={`summary-${summary.summary_id}`}
                            checked={selectedSummaries.includes(summary.summary_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSummaries([...selectedSummaries, summary.summary_id]);
                              } else {
                                setSelectedSummaries(selectedSummaries.filter(id => id !== summary.summary_id));
                              }
                            }}
                            className="mr-2"
                          />
                          <label htmlFor={`summary-${summary.summary_id}`} className="text-xs text-gray-700 truncate">{summary.title}</label>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">暂无摘要</div>
                    )}
                  </div>
                </div>
                
                {/* AI评估 */}
                <button 
                  className="w-full text-left p-1 border border-gray-200 rounded-md hover:bg-blue-50 text-blue-600 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAIEvaluateClick();
                  }}
                >
                  <div className="flex items-center">
                    <Edit3 size={14} className="mr-1" />
                    <span>AI评估</span>
                  </div>
                </button>
                {/* AI帮填 */}
                <button 
                  className="w-full text-left p-1 border border-gray-200 rounded-md hover:bg-purple-50 text-purple-600 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAIAssistClick();
                  }}
                >
                  <div className="flex items-center">
                    <RefreshCw size={14} className="mr-1" />
                    <span>AI帮填</span>
                  </div>
                </button>
                {/* 段落AI信息 */}
                {block.metadata?.ai_eval && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">AI评估</h5>
                    <p className="text-sm text-gray-700">{block.metadata.ai_eval}</p>
                  </div>
                )}
                {block.metadata?.ai_suggestion && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">AI建议</h5>
                    <p className="text-sm text-gray-700">{block.metadata.ai_suggestion}</p>
                  </div>
                )}
                {block.metadata?.ai_generate && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">AI生成</h5>
                    <p className="text-sm text-gray-700">{block.metadata.ai_generate}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* 右侧操作按钮 */}
        <div className="flex flex-col space-y-2 ml-2 sticky top-4">
          {/* 常驻显示的按钮 */}
          <div className="flex space-x-2 bg-white p-1 rounded-md shadow-sm">
            <button 
              className="p-1 text-green-600 hover:text-green-800"
              onClick={(e) => {
                e.stopPropagation();
                addNextParagraph(block.id);
              }}
              title="添加下一段"
            >
              <Plus size={16} />
            </button>
            <button 
              className="p-1 text-red-600 hover:text-red-800"
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(block.id);
              }}
              title="删除当前段"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {/* 只在悬停且非编辑模式时显示的AI按钮 */}
          {hoveredBlockId === block.id && editingBlockId !== block.id && (
            <div className="flex space-x-2 bg-white p-1 rounded-md shadow-sm">
              <button 
                className="p-1 text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(block.id);
                  setSelectedBlockType(block.type);
                  setActiveAIBlockId(block.id);
                  setShowAIAssistant(true);
                }}
                title="AI助手"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-500"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-white border-l border-r border-gray-200 overflow-y-auto">
      {/* 工具栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center"
            onClick={() => generateFullContent(chapterId)}
          >
            <RefreshCw size={16} className="mr-2" />
            一键生成全文
          </button>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
            onClick={() => addNewParagraph(chapterId)}
          >
            <Plus size={16} className="mr-2" />
            新增段落
          </button>
        </div>
      </div>
      
      {/* 章节内容编辑区 */}
      <div className="space-y-6">
        {Array.isArray(chapterContent) && chapterContent.length > 0 ? (
          chapterContent.map((block) => renderBlockContent(block))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-md">
            <p className="text-gray-500 mb-4">章节内容为空</p>
            <button 
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              onClick={() => addNewParagraph(chapterId)}
            >
              新增段落
            </button>
          </div>
        )}
      </div>
      
      {/* AI对话区 */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="flex items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mr-4">AI助手</h3>
          <div className="flex space-x-2">
            <button 
              className={`px-3 py-1 rounded-md text-sm ${aiMode === 'chat' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
              onClick={() => setAiMode('chat')}
            >
              聊天
            </button>
            <button 
              className={`px-3 py-1 rounded-md text-sm ${aiMode === 'revision' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
              onClick={() => setAiMode('revision')}
            >
              修订
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto mb-4">
          {chatMessages.map((message, index) => (
            <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-green-100 text-green-800' : 'bg-white text-gray-800 border border-gray-200'}`}>
                <p>{message.content}</p>
                {message.isRevision && message.paragraphId && (
                  <button 
                    className="mt-2 px-3 py-1 bg-green-500 text-white rounded-md text-xs hover:bg-green-600"
                    onClick={() => message.paragraphId && applyRevision(message.paragraphId, message.content)}
                  >
                    应用修订
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex">
          <input
            type="text"
            value={aiMessage}
            onChange={(e) => setAiMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendAIMessage()}
            placeholder="输入您的问题..."
            className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button 
            className="px-4 py-2 bg-green-500 text-white rounded-r-md hover:bg-green-600"
            onClick={sendAIMessage}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
