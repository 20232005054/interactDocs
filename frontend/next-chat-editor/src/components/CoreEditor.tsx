import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { useChapterStore } from '../store/chapterStore';
import { useAIStore } from '../store/aiStore';
import { useDocumentStore } from '../store/documentStore';
import { Block } from '../lib/types/block';
import { findBlockById, findAndDeleteBlock, generateId } from '../lib/utils/utils';

interface CoreEditorProps {
  documentId: string;
  selectedChapter: string | null;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  isResizing: 'left' | 'right' | false;
  setIsResizing: (resizing: 'left' | 'right' | false) => void;
}

export const CoreEditor: React.FC<CoreEditorProps> = ({
  documentId,
  selectedChapter,
  leftSidebarCollapsed,
  rightSidebarCollapsed,
  isResizing,
  setIsResizing
}) => {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockType, setSelectedBlockType] = useState<string>('paragraph');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [selectedTocItem, setSelectedTocItem] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState<boolean>(false);
  const [activeAIBlockId, setActiveAIBlockId] = useState<string | null>(null);
  const [selectedParagraphs, setSelectedParagraphs] = useState<Array<{paragraph_id: string, content: string}>>([]);

  const {
    chapterContent,
    toc,
    updateChapterContent,
    selectChapter
  } = useChapterStore();

  const {
    handleAIEvaluate,
    handleAIAssist
  } = useAIStore();

  const { document } = useDocumentStore();

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
  };

  // 保存内联编辑
  const saveInlineEdit = async (block: Block) => {
    if (block.type === 'list') {
      block.items = editingValue.split('\n').filter(Boolean);
    } else {
      block.content = editingValue;
    }
    
    try {
      // 更新段落
      const response = await fetch(`/api/v1/paragraphs/${block.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: block.content,
          para_type: block.type,
          order_index: block.order_index || 0
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update paragraph');
      }
      
      // 重置编辑状态
      setEditingBlockId(null);
      setEditingValue('');
      
      // 重置hover状态
      setHoveredBlockId(null);
      
      // 如果修改的是标题类型的段落，更新目录
      if (block.type.startsWith('heading') && selectedChapter) {
        await selectChapter(selectedChapter);
      }
    } catch (err) {
      console.error('Error updating paragraph:', err);
      alert('更新段落失败');
      
      // 重置编辑状态
      setEditingBlockId(null);
      setEditingValue('');
      
      // 重置hover状态
      setHoveredBlockId(null);
    }
  };

  // 取消内联编辑
  const cancelInlineEdit = () => {
    // 重置编辑状态
    setEditingBlockId(null);
    setEditingValue('');
    
    // 重置hover状态
    setHoveredBlockId(null);
  };

  // 删除Block
  const deleteBlock = async (blockId: string) => {
    if (!Array.isArray(chapterContent)) return;

    try {
      const response = await fetch(`/api/v1/paragraphs/${blockId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete paragraph');
      }

      const updatedBlocks = [...chapterContent];
      if (findAndDeleteBlock(updatedBlocks, blockId)) {
        await updateChapterContent(updatedBlocks);
      }
    } catch (err) {
      console.error('Error deleting paragraph:', err);
      alert('删除段落失败');
    }
  };

  // 添加下一段
  const addNextParagraph = async (blockId: string) => {
    if (!Array.isArray(chapterContent) || !selectedChapter) return;

    try {
      // 找到当前块
      const findBlock = (blocks: Block[]): Block | null => {
        for (const block of blocks) {
          if (block.id === blockId) {
            return block;
          }
          if (block.children && Array.isArray(block.children)) {
            const found = findBlock(block.children);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const currentBlock = findBlock(chapterContent);
      if (!currentBlock) return;

      // 计算新段落的order_index
      const currentOrderIndex = currentBlock.order_index || 0;
      const newOrderIndex = currentOrderIndex + 1;

      // 发送请求创建新段落
      const response = await fetch(`/api/v1/chapters/${selectedChapter}/paragraphs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '',
          para_type: 'paragraph',
          order_index: newOrderIndex
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create paragraph');
      }
      
      const data = await response.json();
      const newParagraph: Block = {
        id: data.data.paragraph_id,
        type: data.data.para_type,
        content: data.data.content,
        order_index: data.data.order_index,
        metadata: {}
      };

      // 找到当前块的位置并在其后添加新段落
      const addAfterBlock = (blocks: Block[]): boolean => {
        for (let i = 0; i < blocks.length; i++) {
          if (blocks[i].id === blockId) {
            blocks.splice(i + 1, 0, newParagraph);
            return true;
          }
          if (blocks[i].children && Array.isArray(blocks[i].children)) {
            if (addAfterBlock(blocks[i].children as Block[])) {
              return true;
            }
          }
        }
        return false;
      };

      if (Array.isArray(chapterContent)) {
        addAfterBlock(chapterContent);
      }
      
      // 更新后续段落的order_index
      const updateOrderIndexes = (blocks: Block[]) => {
        blocks.forEach((block, index) => {
          if (block.order_index && block.order_index >= newOrderIndex && block.id !== newParagraph.id) {
            block.order_index += 1;
            // 同步更新到服务器
            fetch(`/api/v1/paragraphs/${block.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: block.content,
                para_type: block.type,
                order_index: block.order_index
              }),
            });
          }
          if (block.children && Array.isArray(block.children)) {
            updateOrderIndexes(block.children);
          }
        });
      };

      if (Array.isArray(chapterContent)) {
        updateOrderIndexes(chapterContent);
        await updateChapterContent(chapterContent);
      }
    } catch (err) {
      console.error('Error creating paragraph:', err);
      alert('创建段落失败');
    }
  };

  // 修改段落类型
  const changeBlockType = async (blockId: string, newType: string) => {
    if (!Array.isArray(chapterContent)) return;

    const block = findBlockById(chapterContent, blockId);
    if (block) {
      try {
        // 更新段落类型
        const response = await fetch(`/api/v1/paragraphs/${blockId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: block.content,
            para_type: newType,
            order_index: block.order_index || 0
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update paragraph type');
        }
        
        block.type = newType;
        await updateChapterContent(chapterContent);
      } catch (err) {
        console.error('Error updating paragraph type:', err);
        alert('更新段落类型失败');
      }
    }
  };

  // 选择段落时更新类型
  const handleSelectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    if (Array.isArray(chapterContent)) {
      const block = findBlockById(chapterContent, blockId);
      if (block) {
        setSelectedBlockType(block.type);
        // 更新选中的段落
        setSelectedParagraphs([{
          paragraph_id: blockId,
          content: typeof block.content === 'string' ? block.content : ''
        }]);
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
        className="mb-4 flex items-center block-element"
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
                  // 同步更新到服务器
                  fetch(`/api/v1/paragraphs/${block.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      content: block.content,
                      para_type: block.type,
                      order_index: block.order_index
                    }),
                  });
                });
                
                updateChapterContent(newBlocks);
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
                {/* AI评估 */}
                <button 
                  className="w-full text-left p-1 border border-gray-200 rounded-md hover:bg-blue-50 text-blue-600 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAIEvaluate(selectedChapter!, document, block);
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
                    handleAIAssist(selectedChapter!, document, block, (content) => updateChapterContent(content));
                  }}
                >
                  <div className="flex items-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM10 8L16 12L10 16V8Z" fill="currentColor"/>
                    </svg>
                    <span className="ml-1">AI帮填</span>
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

  if (!selectedChapter) {
    return (
      <div className="flex-1 flex flex-col bg-white relative">
        {/* 左侧调整大小的手柄 */}
        {!leftSidebarCollapsed && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 cursor-col-resize hover:bg-green-300 z-10"
            onMouseDown={() => setIsResizing('left')}
            style={{ userSelect: 'none' }}
          />
        )}
        
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">请从左侧选择一个章节开始编辑</p>
        </div>
        
        {/* 调整大小的手柄 */}
        {!rightSidebarCollapsed && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-1 bg-gray-200 cursor-col-resize hover:bg-green-300"
            onMouseDown={() => setIsResizing('right')}
            style={{ userSelect: 'none' }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white relative">
      {/* 左侧调整大小的手柄 */}
      {!leftSidebarCollapsed && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 cursor-col-resize hover:bg-green-300 z-10"
          onMouseDown={() => setIsResizing('left')}
          style={{ userSelect: 'none' }}
        />
      )}
      
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          {/* 章节目录 */}
          {toc.length > 0 && (
            <div className="mb-8 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">目录</h3>
                <button 
                  className="text-gray-600 hover:text-gray-800"
                  onClick={() => setTocCollapsed(!tocCollapsed)}
                >
                  {tocCollapsed ? '展开' : '收起'}
                </button>
              </div>
              {!tocCollapsed && (
                <div className="space-y-2">
                  {toc.map((item, index) => (
                    <div 
                      key={index}
                      className={`pl-${item.level * 4} cursor-pointer ${selectedTocItem === item.id ? 'text-green-600 font-medium' : 'text-gray-800'}`}
                      onClick={() => {
                        setSelectedTocItem(item.id);
                        // 滚动到对应标题
                        const element = window.document.getElementById(item.id);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* 章节内容 */}
          {Array.isArray(chapterContent) ? (
            <div className="space-y-4">
              {chapterContent.map((block) => renderBlockContent(block))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">章节内容为空，请开始编辑</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 调整大小的手柄 */}
      {!rightSidebarCollapsed && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 bg-gray-200 cursor-col-resize hover:bg-green-300"
          onMouseDown={() => setIsResizing('right')}
          style={{ userSelect: 'none' }}
        />
      )}
    </div>
  );
};
