'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, ChevronLeft, Check, Plus, Trash2, Edit3, Send } from 'lucide-react';

export default function KeywordPage({ params }: { params: Promise<{ id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [document, setDocument] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(280);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState<boolean>(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(300);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [recentDocsExpanded, setRecentDocsExpanded] = useState<boolean>(true);
  const [docDetailsExpanded, setDocDetailsExpanded] = useState<boolean>(true);
  const [editingDocDetail, setEditingDocDetail] = useState<string | null>(null);
  const [docDetailValue, setDocDetailValue] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'snapshots' | 'related'>('snapshots');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [showAddChapterModal, setShowAddChapterModal] = useState<boolean>(false);
  const [showEditChapterModal, setShowEditChapterModal] = useState<boolean>(false);
  const [parentChapterId, setParentChapterId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [editChapterId, setEditChapterId] = useState<string>('');
  const [editChapterTitle, setEditChapterTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string, id?: number}>>([
    { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
  ]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [purposeOptions, setPurposeOptions] = useState<string[]>([]);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);

  // 初始化文档ID
  useEffect(() => {
    const initDocumentId = async () => {
      const { id } = await params;
      setDocumentId(id);
    };
    initDocumentId();
  }, [params]);

  // 获取使用目的选项
  useEffect(() => {
    const fetchPurposeOptions = async () => {
      try {
        const response = await fetch('/api/metadata/generate');
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.fields) {
            const purposeField = data.data.fields.find((field: any) => field.field === 'purpose');
            if (purposeField && purposeField.options) {
              setPurposeOptions(purposeField.options);
            }
          }
        }
      } catch (error) {
        console.error('获取使用目的选项失败:', error);
      }
    };
    fetchPurposeOptions();
  }, []);

  // 获取模板数据
  useEffect(() => {
    const fetchTemplateData = async () => {
      try {
        // 获取模板用途
        const purposesResponse = await fetch('/api/v1/templates/purposes/list');
        if (purposesResponse.ok) {
          const purposesData = await purposesResponse.json();
          setTemplatePurposes(purposesData.data.purposes || []);
        }

        // 获取所有模板
        const templatesResponse = await fetch('/api/v1/templates');
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          setTemplates(templatesData.data.items || []);

          // 按用途分组模板
          const templatesByPurposeMap: Record<string, any[]> = {};
          templatesData.data.items.forEach((template: any) => {
            if (!templatesByPurposeMap[template.purpose]) {
              templatesByPurposeMap[template.purpose] = [];
            }
            templatesByPurposeMap[template.purpose].push(template);
          });
          setTemplatesByPurpose(templatesByPurposeMap);
        }
      } catch (error) {
        console.error('获取模板数据失败:', error);
      }
    };
    fetchTemplateData();
  }, []);

  // 根据模板ID获取模板详情
  const fetchTemplateById = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        setTemplateName(data.data.display_name || '未知模板');
      }
    } catch (error) {
      console.error('获取模板详情失败:', error);
      setTemplateName('未知模板');
    }
  };

  // 加载文档数据
  useEffect(() => {
    if (!documentId) return;
    
    const fetchDocumentData = async () => {
      setIsLoading(true);
      try {
        // 获取文档详情
        const documentResponse = await fetch(`/api/v1/documents/${documentId}`);
        if (!documentResponse.ok) {
          throw new Error('Failed to fetch document');
        }
        const documentData = await documentResponse.json();
        setDocument(documentData.data);
        
        // 如果有模板ID，获取模板详情
        if (documentData.data.template_id) {
          fetchTemplateById(documentData.data.template_id);
        }

        // 获取章节列表
        const chaptersResponse = await fetch(`/api/v1/documents/${documentId}/chapters`);
        if (!chaptersResponse.ok) {
          throw new Error('Failed to fetch chapters');
        }
        const chaptersData = await chaptersResponse.json();
        setChapters(chaptersData.data.chapters || []);

        // 获取最近文档
        const recentResponse = await fetch('/api/v1/documents?page=1&page_size=5');
        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          setRecentDocuments(recentData.data.items || []);
        }

        // 获取快照
        const snapshotsResponse = await fetch(`/api/v1/documents/${documentId}/snapshots`);
        if (snapshotsResponse.ok) {
          const snapshotsData = await snapshotsResponse.json();
          setSnapshots(snapshotsData.data.snapshots || []);
        }

        // 获取关键词
        fetchKeywords();
      } catch (err) {
        console.error('Error fetching document data:', err);
        setError('加载文档数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocumentData();
  }, [documentId]);

  // 鼠标移动事件处理（用于调整侧边栏大小）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'left' && leftSidebarRef.current) {
        const container = leftSidebarRef.current.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const newWidth = e.clientX - containerRect.left;
          if (newWidth > 100 && newWidth < 400) {
            setLeftSidebarWidth(newWidth);
          }
        }
      } else if (isResizing === 'right' && rightSidebarRef.current) {
        const container = rightSidebarRef.current.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const newWidth = containerRect.right - e.clientX;
          if (newWidth > 100 && newWidth < 400) {
            setRightSidebarWidth(newWidth);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 获取关键词列表
  const fetchKeywords = async () => {
    if (!documentId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/documents/${documentId}/keywords`);
      const data = await response.json();
      
      if (data.code === 200) {
        setKeywords(data.data.keywords || []);
      }
    } catch (error) {
      console.error('获取关键词失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 创建关键词
  const createKeyword = async (keyword: string) => {
    if (!documentId || !keyword.trim()) return;
    
    try {
      const response = await fetch('/api/v1/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          keyword: keyword.trim(),
        }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        fetchKeywords();
        setNewKeyword('');
      }
    } catch (error) {
      console.error('创建关键词失败:', error);
    }
  };

  // 更新关键词
  const updateKeyword = async (keyword_id: string, keyword: string) => {
    if (!keyword.trim()) return;
    
    try {
      const response = await fetch(`/api/v1/keywords/${keyword_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        fetchKeywords();
        setEditingKeywordId(null);
      }
    } catch (error) {
      console.error('更新关键词失败:', error);
    }
  };

  // 删除关键词
  const deleteKeyword = async (keyword_id: string) => {
    try {
      const response = await fetch(`/api/v1/keywords/${keyword_id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      if (data.code === 200) {
        // 直接从状态中移除对应的关键词，实现无感刷新
        setKeywords(prevKeywords => prevKeywords.filter(keyword => keyword.keyword_id !== keyword_id));
      }
    } catch (error) {
      console.error('删除关键词失败:', error);
    }
  };

  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  // 模板相关状态
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatePurposes, setTemplatePurposes] = useState<string[]>([]);
  const [templatesByPurpose, setTemplatesByPurpose] = useState<Record<string, any[]>>({});
  const [templateName, setTemplateName] = useState<string>('');

  // AI 生成关键词
  const generateKeywords = async () => {
    if (!documentId) return;
    
    try {
      setIsGeneratingKeywords(true);
      const response = await fetch('/api/v1/keywords/ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId }),
      });
      
      const data = await response.json();
      if (data.code === 200) {
        fetchKeywords();
      }
    } catch (error) {
      console.error('AI 生成关键词失败:', error);
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  // 开始编辑关键词
  const startEditing = (keyword: any) => {
    setEditingKeywordId(keyword.keyword_id);
    setEditValue(keyword.keyword);
  };

  // 保存编辑
  const saveEdit = (keyword_id: string) => {
    updateKeyword(keyword_id, editValue);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingKeywordId(null);
    setEditValue('');
  };

  // 切换章节展开/折叠状态
  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // 打开添加章节弹窗
  const openAddChapterModal = (parentId: string | null = null) => {
    setParentChapterId(parentId);
    setNewChapterTitle('');
    setShowAddChapterModal(true);
  };

  // 打开编辑章节弹窗
  const openEditChapterModal = (chapterId: string, title: string) => {
    setEditChapterId(chapterId);
    setEditChapterTitle(title);
    setShowEditChapterModal(true);
  };

  // 添加章节
  const addChapter = async () => {
    if (!documentId || !newChapterTitle.trim()) return;
    try {
      const response = await fetch('/api/v1/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          parent_id: parentChapterId,
          title: newChapterTitle.trim(),
          order_index: chapters.length
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to add chapter');
      }
      const data = await response.json();
      const newChapter = data.data;
      setChapters(prev => [...prev, newChapter]);
      setShowAddChapterModal(false);
    } catch (err) {
      console.error('Error adding chapter:', err);
      alert('添加章节失败');
    }
  };

  // 更新章节标题
  const updateChapterTitle = async () => {
    if (!editChapterId || !editChapterTitle.trim()) return;
    try {
      const response = await fetch(`/api/v1/chapters/${editChapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editChapterTitle.trim()
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update chapter title');
      }
      const data = await response.json();
      const updatedChapter = data.data;
      setChapters(prev => prev.map(chapter => 
        chapter.chapter_id === editChapterId ? updatedChapter : chapter
      ));
      setShowEditChapterModal(false);
    } catch (err) {
      console.error('Error updating chapter title:', err);
      alert('更新章节标题失败');
    }
  };

  // 删除章节
  const deleteChapter = async (chapterId: string) => {
    if (!confirm('确定要删除这个章节吗？')) return;
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }
      setChapters(prev => prev.filter(chapter => chapter.chapter_id !== chapterId));
    } catch (err) {
      console.error('Error deleting chapter:', err);
      alert('删除章节失败');
    }
  };

  // 切换章节状态
  const toggleChapterStatus = async (chapterId: string) => {
    const chapter = chapters.find(c => c.chapter_id === chapterId);
    if (!chapter) return;
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: chapter.status === 'completed' ? 'editing' : 'completed'
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update chapter status');
      }
      const data = await response.json();
      const updatedChapter = data.data;
      setChapters(prev => prev.map(chapter => 
        chapter.chapter_id === chapterId ? updatedChapter : chapter
      ));
    } catch (err) {
      console.error('Error updating chapter status:', err);
      alert('更新章节状态失败');
    }
  };

  // 更新文档信息
  const updateDocumentInfo = async (field: string, value: string | string[]) => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/v1/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update document info');
      }

      const data = await response.json();
      setDocument(data.data);
      
      // 如果更新的是模板ID，重新获取模板详情
      if (field === 'template_id' && value) {
        fetchTemplateById(value as string);
      }
      
      setEditingDocDetail(null);
      setDocDetailValue('');
    } catch (err) {
      console.error('Error updating document info:', err);
      alert('更新文档信息失败');
    }
  };

  // 构建章节树
  const buildChapterTree = (parentId: string | null = null) => {
    return chapters
      .filter((chapter: any) => chapter.parent_id === parentId)
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((chapter: any) => {
        const isExpanded = expandedChapters.has(chapter.chapter_id);
        const hasChildren = chapters.some((c: any) => c.parent_id === chapter.chapter_id);

        return (
          <div key={chapter.chapter_id} className="mb-1">
            <div 
              className={`flex items-center p-2 rounded-md cursor-pointer hover:bg-green-50 text-gray-800`}
              onClick={() => {
                // 跳转到章节页面
                window.location.href = `/document/${documentId}/${chapter.chapter_id}`;
              }}
              title={chapter.title}
            >
              {!leftSidebarCollapsed && hasChildren && (
                <button 
                  className="mr-2 text-green-600 hover:text-green-800" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChapter(chapter.chapter_id);
                  }}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              {!leftSidebarCollapsed && !hasChildren && <div className="w-4 mr-2" />}
              <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>{chapter.title}</span>
              {leftSidebarCollapsed && (
                <div className="flex items-center justify-center">
                  {chapter.status === 'completed' ? <Check size={16} /> : <Edit3 size={16} />}
                </div>
              )}
              {!leftSidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <button 
                    className="text-green-600 hover:text-green-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChapterStatus(chapter.chapter_id);
                    }}
                  >
                    {chapter.status === 'completed' ? <Check size={16} /> : <Edit3 size={16} />}
                  </button>
                  <button 
                    className="text-green-600 hover:text-green-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditChapterModal(chapter.chapter_id, chapter.title);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    className="text-green-600 hover:text-green-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddChapterModal(chapter.chapter_id);
                    }}
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    className="text-red-600 hover:text-red-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChapter(chapter.chapter_id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            {!leftSidebarCollapsed && hasChildren && isExpanded && (
              <div className="pl-6 mt-1">
                {buildChapterTree(chapter.chapter_id)}
              </div>
            )}
          </div>
        );
      });
  };

  // 处理点击外部保存编辑
  useEffect(() => {
    const handleClickOutside = () => {
      if (editingKeywordId) {
        saveEdit(editingKeywordId);
      }
    };

    if (typeof window !== 'undefined') {
      window.document.addEventListener('click', handleClickOutside);
      return () => {
        window.document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [editingKeywordId, editValue]);

  // 发送AI消息
  const sendAIMessage = async () => {
    if (!aiMessage.trim() || !documentId) return;

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: aiMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setAiMessage('');

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '', id: aiMessageId }]);

    try {
      // 构建selected_keywords - 只包含选中的关键词
      const selectedKeywordList = keywords
        .filter(keyword => selectedKeywords.has(keyword.keyword_id))
        .map(keyword => ({
          keyword_id: keyword.keyword_id,
          keyword: keyword.keyword
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
          selected_keywords: selectedKeywordList
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
        const { done, value } = await reader.read();
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
    } catch (err) {
      console.error('Error sending AI message:', err);
      // 更新错误消息
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: '抱歉，我暂时无法处理您的请求，请稍后再试。' } : msg
      ));
    }
  };

  if (isLoading) {
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
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 */}
        <div 
          ref={leftSidebarRef}
          className={`bg-white border-r border-gray-200 p-4 overflow-y-auto transition-all duration-300 ease-in-out ${leftSidebarCollapsed ? 'w-16' : ''}`} 
          style={{ width: leftSidebarCollapsed ? '64px' : `${leftSidebarWidth}px`, transition: 'none' }}
        >
          {/* 文档标题 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-lg font-semibold text-gray-900 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>{document?.title || '文档'}</h2>
              <div className="flex items-center space-x-2">
                <button 
                  className="text-green-600 hover:text-green-800"
                  onClick={() => openAddChapterModal()}
                >
                  <Plus size={18} />
                </button>
                <button 
                  className="text-gray-600 hover:text-gray-800"
                  onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
                >
                  {leftSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
              </div>
            </div>
            {!leftSidebarCollapsed && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">最近文档</span>
                    <button 
                      className="text-gray-600 hover:text-gray-800"
                      onClick={() => setRecentDocsExpanded(!recentDocsExpanded)}
                    >
                      {recentDocsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                  <button 
                    className="text-xs text-green-600 hover:text-green-800"
                    onClick={() => window.location.href = '/documents'}
                  >
                    全部文档
                  </button>
                </div>
                {recentDocsExpanded && (
                  <div className="space-y-2">
                    {recentDocuments.map((doc: any) => (
                      <div 
                        key={doc.document_id}
                        className={`p-2 rounded-md text-sm cursor-pointer ${doc.document_id === documentId ? 'bg-green-100 text-green-800' : 'hover:bg-gray-100 text-gray-800'}`}
                        onClick={() => window.location.href = `/document/${doc.document_id}/keyword`}
                        title={doc.title}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{doc.title}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(doc.updated_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 文档详情 */}
          {!leftSidebarCollapsed && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">文档详情</span>
                  <button 
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => setDocDetailsExpanded(!docDetailsExpanded)}
                  >
                    {docDetailsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>
              {docDetailsExpanded && document && (
                <div className="space-y-3">
                  {/* 标题 */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>文档标题</span>
                      <button 
                        className="text-green-600 hover:text-green-800"
                        onClick={() => {
                          setEditingDocDetail('title');
                          setDocDetailValue(document.title || '');
                        }}
                      >
                        编辑
                      </button>
                    </div>
                    {editingDocDetail === 'title' ? (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={docDetailValue}
                          onChange={(e) => setDocDetailValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                          placeholder="请输入文档标题"
                        />
                        <button 
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                          onClick={() => updateDocumentInfo('title', docDetailValue)}
                        >
                          保存
                        </button>
                        <button 
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                          onClick={() => {
                            setEditingDocDetail(null);
                            setDocDetailValue('');
                          }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded-md">
                        {document.title}
                      </div>
                    )}
                  </div>
                  
                  {/* 关键词 */}
                  {document.keywords && document.keywords.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>关键词</span>
                        <button 
                          className="text-green-600 hover:text-green-800"
                          onClick={() => {
                            setEditingDocDetail('keywords');
                            setDocDetailValue(document.keywords.join(' '));
                          }}
                        >
                          编辑
                        </button>
                      </div>
                      {editingDocDetail === 'keywords' ? (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={docDetailValue}
                            onChange={(e) => setDocDetailValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                            placeholder="请输入关键词，用空格分隔"
                          />
                          <button 
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                            onClick={() => updateDocumentInfo('keywords', docDetailValue.split(' ').filter(Boolean))}
                          >
                            保存
                          </button>
                          <button 
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                            onClick={() => {
                              setEditingDocDetail(null);
                              setDocDetailValue('');
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded-md">
                          {document.keywords.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 摘要 */}
                  {document.abstract && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>摘要</span>
                        <button 
                          className="text-green-600 hover:text-green-800"
                          onClick={() => {
                            setEditingDocDetail('abstract');
                            setDocDetailValue(document.abstract || '');
                          }}
                        >
                          编辑
                        </button>
                      </div>
                      {editingDocDetail === 'abstract' ? (
                        <div className="flex flex-col space-y-2">
                          <textarea
                            value={docDetailValue}
                            onChange={(e) => setDocDetailValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                            placeholder="请输入摘要"
                            rows={3}
                          />
                          <div className="flex space-x-2 justify-end">
                            <button 
                              className="px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                              onClick={() => updateDocumentInfo('abstract', docDetailValue)}
                            >
                              保存
                            </button>
                            <button 
                              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                              onClick={() => {
                                setEditingDocDetail(null);
                                setDocDetailValue('');
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded-md">
                          {document.abstract}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 目的 */}
                  {document.purpose && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>使用目的</span>
                        <button 
                          className="text-green-600 hover:text-green-800"
                          onClick={() => {
                            setEditingDocDetail('purpose');
                            setDocDetailValue(document.purpose || '');
                          }}
                        >
                          编辑
                        </button>
                      </div>
                      {editingDocDetail === 'purpose' ? (
                        <div className="flex space-x-2">
                          <select
                            value={docDetailValue}
                            onChange={(e) => setDocDetailValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                          >
                            <option value="">请选择</option>
                            {purposeOptions.map((option, index) => (
                              <option key={index} value={option}>{option}</option>
                            ))}
                          </select>
                          <button 
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                            onClick={() => updateDocumentInfo('purpose', docDetailValue)}
                          >
                            保存
                          </button>
                          <button 
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                            onClick={() => {
                              setEditingDocDetail(null);
                              setDocDetailValue('');
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded-md">
                          {document.purpose}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 模板类型 */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>模板类型</span>
                      <button 
                        className="text-green-600 hover:text-green-800"
                        onClick={() => {
                          setEditingDocDetail('template');
                          setDocDetailValue(document.template_id || '');
                        }}
                      >
                        编辑
                      </button>
                    </div>
                    {editingDocDetail === 'template' ? (
                      <div className="flex space-x-2">
                        <select
                          value={docDetailValue}
                          onChange={(e) => setDocDetailValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">请选择</option>
                          {templates.map((template, index) => (
                            <option key={index} value={template.template_id}>{template.display_name}</option>
                          ))}
                        </select>
                        <button 
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                          onClick={() => updateDocumentInfo('template_id', docDetailValue)}
                        >
                          保存
                        </button>
                        <button 
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                          onClick={() => {
                            setEditingDocDetail(null);
                            setDocDetailValue('');
                          }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded-md">
                        {document.template_id ? templateName : '未选择模板'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 关键词按钮 */}
          <div className="mb-6">
            <button
              className="w-full flex items-center p-2 rounded-md bg-green-100 text-green-800"
              onClick={() => {
                // 保持在当前关键词页面
              }}
            >
              <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>关键词</span>
            </button>
          </div>
          
          {/* 摘要按钮 */}
          <div className="mb-6">
            <a
              href={`/document/${documentId}/summary`}
              className={`w-full flex items-center p-2 rounded-md hover:bg-green-50 text-gray-800`}
            >
              <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>摘要</span>
            </a>
          </div>
          
          {/* 章节列表 */}
          <div className="mb-6">
            <h3 className={`text-sm font-medium text-gray-700 mb-3 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>章节</h3>
            {buildChapterTree()}
          </div>

          {/* 快照和关联文档 */}
          {!leftSidebarCollapsed && (
            <div>
              <h3 className={`text-sm font-medium text-gray-700 mb-3`}>快照与关联</h3>
              {/* 标签页 */}
              <div className="flex border-b border-gray-200 mb-3">
                <button 
                  className={`flex-1 py-1 text-center text-xs font-medium rounded-t-md ${activeTab === 'snapshots' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
                  onClick={() => setActiveTab('snapshots')}
                >
                  快照存档
                </button>
                <button 
                  className={`flex-1 py-1 text-center text-xs font-medium rounded-t-md ${activeTab === 'related' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
                  onClick={() => setActiveTab('related')}
                >
                  关联文档
                </button>
              </div>

              {/* 内容区 */}
              <div className="max-h-48 overflow-y-auto">
                {activeTab === 'snapshots' ? (
                  <div className="space-y-2">
                    {snapshots.length > 0 ? (
                      snapshots.map((snapshot: any) => (
                        <div 
                          key={snapshot.version_id} 
                          className={`p-2 border rounded-md cursor-pointer hover:bg-green-50`}
                          onClick={() => {
                            // 跳转到章节页面并应用快照
                            if (chapters.length > 0) {
                              window.location.href = `/document/${documentId}/${chapters[0].chapter_id}`;
                            }
                          }}
                        >
                          <div className="text-xs font-medium text-gray-900">{snapshot.description}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(snapshot.created_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-center text-xs text-gray-500">
                        暂无快照
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 border border-gray-200 rounded-md hover:bg-green-50 cursor-pointer">
                      <div className="text-xs font-medium text-gray-900">项目核心信息</div>
                      <div className="text-xs text-gray-500">依赖上级</div>
                    </div>
                    <div className="p-2 border border-gray-200 rounded-md hover:bg-green-50 cursor-pointer">
                      <div className="text-xs font-medium text-gray-900">方案正文</div>
                      <div className="text-xs text-gray-500">结局指标-依赖下级</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 中间核心编辑区 */}
        <div className="flex-1 flex flex-col bg-white relative">
          {/* 左侧调整大小的手柄 */}
          {!leftSidebarCollapsed && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 cursor-col-resize hover:bg-green-300 z-10"
              onMouseDown={() => setIsResizing('left')}
              style={{ userSelect: 'none' }}
            />
          )}
          
          <div className="flex-1 flex flex-col">
            {/* 关键词头部 */}
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">关键词管理</h2>
            </div>
            
            {/* 关键词编辑区 */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 128px)' }}>
              <div className="max-w-3xl mx-auto p-6">
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium text-gray-900">关键词管理</h3>
                  </div>
                  
                  {/* 添加新关键词 */}
                  <div className="mb-6 flex space-x-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && createKeyword(newKeyword)}
                      placeholder="输入新关键词"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                    />
                    <button
                      onClick={() => createKeyword(newKeyword)}
                      disabled={!newKeyword.trim()}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      添加
                    </button>
                  </div>

                  {/* 关键词列表 */}
                  {keywords.length > 0 ? (
                    <div className="space-y-3">
                      {keywords.map((keyword) => {
                        const isSelected = selectedKeywords.has(keyword.keyword_id);
                        return (
                          <div key={keyword.keyword_id} className={`flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 ${isSelected ? 'bg-green-50 border-green-300' : ''}`}>
                            {/* 左侧点击选择区域 */}
                            <div 
                              className="w-8 h-8 flex items-center justify-center mr-3 cursor-pointer"
                              onClick={() => {
                                setSelectedKeywords(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(keyword.keyword_id)) {
                                    newSet.delete(keyword.keyword_id);
                                  } else {
                                    newSet.add(keyword.keyword_id);
                                  }
                                  return newSet;
                                });
                              }}
                            >
                              {isSelected && (
                                <Check size={18} className="text-green-500" />
                              )}
                            </div>
                            
                            {/* 关键词内容 */}
                            {editingKeywordId === keyword.keyword_id ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(keyword.keyword_id)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') saveEdit(keyword.keyword_id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                                className="flex-1 px-3 py-1 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                              />
                            ) : (
                              <div 
                                className="flex-1 cursor-pointer text-gray-900 font-medium"
                                onClick={() => startEditing(keyword)}
                              >
                                {keyword.keyword}
                              </div>
                            )}
                            
                            {/* 删除按钮 */}
                            <button
                              onClick={() => deleteKeyword(keyword.keyword_id)}
                              className="ml-4 text-red-500 hover:text-red-700"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">暂无关键词</p>
                      <button
                        onClick={generateKeywords}
                        disabled={isGeneratingKeywords}
                        className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-green-600"
                      >
                        {isGeneratingKeywords ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span>生成中...</span>
                          </div>
                        ) : (
                          "AI 生成关键词"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
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

        {/* 右侧AI对话区 */}
        <div 
          ref={rightSidebarRef}
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
            <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(100vh - 200px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="flex items-start justify-end">
                    <div className="bg-purple-50 rounded-lg rounded-tr-none p-3 max-w-[80%]">
                      <p className="text-gray-800 text-sm">{message.content}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold ml-2">
                      我
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* 输入区域 */}
          {!rightSidebarCollapsed && (
            <div className="p-4 border-t border-gray-200">
              {/* 选中提示 */}
              {selectedKeywords.size > 0 && (
                <div 
                  className="mb-3 text-xs text-green-600 bg-green-50 p-2 rounded-md cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => setSelectedKeywords(new Set())}
                  title="点击取消所有选中"
                >
                  已选中所选内容
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendAIMessage()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="输入消息..."
                />
                <button 
                  className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                  onClick={sendAIMessage}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 添加章节弹窗 */}
      {showAddChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {parentChapterId ? '添加子章节' : '添加章节'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                章节标题
              </label>
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                placeholder="请输入章节标题"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowAddChapterModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button 
                onClick={addChapter}
                className="px-4 py-2 text-white bg-green-500 rounded-md hover:bg-green-600"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑章节弹窗 */}
      {showEditChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              编辑章节
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                章节标题
              </label>
              <input
                type="text"
                value={editChapterTitle}
                onChange={(e) => setEditChapterTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                placeholder="请输入章节标题"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowEditChapterModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button 
                onClick={updateChapterTitle}
                className="px-4 py-2 text-white bg-green-500 rounded-md hover:bg-green-600"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

