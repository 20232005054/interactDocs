'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Check, Plus, Trash2, Edit3, RefreshCw, Send, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function SummaryManager({ params }: { params: Promise<{ id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [document, setDocument] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummaryTitle, setEditingSummaryTitle] = useState('');
  const [editingSummaryContent, setEditingSummaryContent] = useState('');
  const [hoveredSummaryId, setHoveredSummaryId] = useState<string | null>(null);
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
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [showAddChapterModal, setShowAddChapterModal] = useState<boolean>(false);
  const [showEditChapterModal, setShowEditChapterModal] = useState<boolean>(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState<boolean>(false);
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [parentChapterId, setParentChapterId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [editChapterId, setEditChapterId] = useState<string>('');
  const [editChapterTitle, setEditChapterTitle] = useState<string>('');
  const [snapshotDescription, setSnapshotDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingSummary, setGeneratingSummary] = useState<boolean>(false);
  const [summaryKeywordLinks, setSummaryKeywordLinks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string, id?: number}>>([
    { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
  ]);
  const [selectedSummaries, setSelectedSummaries] = useState<Set<string>>(new Set());
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

  // 获取摘要关键词关联表
  const fetchSummaryKeywordLinks = async () => {
    if (!documentId) return;
    try {
      // 获取所有摘要
      const summariesResponse = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!summariesResponse.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const summariesData = await summariesResponse.json();
      const summariesList = summariesData.data.summaries || [];

      // 对每个摘要获取关联的关键词
      const links = [];
      for (const summary of summariesList) {
        const keywordsResponse = await fetch(`/api/v1/summaries/${summary.summary_id}/keywords`);
        if (keywordsResponse.ok) {
          const keywordsData = await keywordsResponse.json();
          const keywords = keywordsData.data.keywords || [];
          links.push({
            summary_id: summary.summary_id,
            summary_title: summary.title,
            keywords: keywords
          });
        }
      }
      setSummaryKeywordLinks(links);
    } catch (err) {
      console.error('Error fetching summary-keyword links:', err);
    }
  };

  // 加载文档数据
  useEffect(() => {
    if (!documentId) return;
    
    const fetchDocumentData = async () => {
      setLoading(true);
      try {
        // 获取文档详情
        const documentResponse = await fetch(`/api/v1/documents/${documentId}`);
        if (!documentResponse.ok) {
          throw new Error('Failed to fetch document');
        }
        const documentData = await documentResponse.json();
        setDocument(documentData.data);

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

        // 获取摘要
        await fetchSummaries();
        // 获取摘要关键词关联表
        fetchSummaryKeywordLinks();
      } catch (err) {
        console.error('Error fetching document data:', err);
        setError('加载文档数据失败');
      } finally {
        setLoading(false);
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

  // 全局点击事件处理，点击编辑区域外部时保存摘要
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingSummaryId) {
        // 检查点击是否在编辑区域外部
        const target = e.target as HTMLElement;
        const editContainer = target.closest('.border-gray-200');
        if (!editContainer) {
          // 点击在编辑区域外部，保存摘要
          saveSummary(editingSummaryId);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleClickOutside);
      return () => {
        window.removeEventListener('click', handleClickOutside);
      };
    }
  }, [editingSummaryId]);

  // 获取摘要列表
  const fetchSummaries = async () => {
    if (!documentId) return;
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const data = await response.json();
      // 按order_index排序
      const sortedSummaries = (data.data.summaries || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      setSummaries(sortedSummaries);
    } catch (err) {
      console.error('Error fetching summaries:', err);
    }
  };

  // 开始编辑摘要
  const startEditSummary = (summary: any) => {
    setEditingSummaryId(summary.summary_id);
    setEditingSummaryTitle(summary.title);
    setEditingSummaryContent(summary.content);
  };

  // 保存摘要
  const saveSummary = async (summaryId: string) => {
    try {
      const response = await fetch(`/api/v1/summaries/${summaryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingSummaryTitle,
          content: editingSummaryContent
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update summary');
      }
      const data = await response.json();
      const updatedSummary = data.data;
      setSummaries(prev => prev.map((s: any) => 
        s.summary_id === summaryId ? updatedSummary : s
      ));
      setEditingSummaryId(null);
    } catch (err) {
      console.error('Error updating summary:', err);
      alert('更新摘要失败');
    }
  };

  // 创建摘要
  const createSummary = async () => {
    if (!documentId) return;
    try {
      // 计算新摘要的order_index
      const newOrderIndex = summaries.length;
      
      const response = await fetch('/api/v1/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: '',
          content: '',
          order_index: newOrderIndex
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create summary');
      }
      const data = await response.json();
      const newSummary = data.data;
      setSummaries(prev => [...prev, newSummary]);
      startEditSummary(newSummary);
      // 更新摘要关键词关联表
      fetchSummaryKeywordLinks();
    } catch (err) {
      console.error('Error creating summary:', err);
      alert('创建摘要失败');
    }
  };

  // 删除摘要
  const deleteSummary = async (summaryId: string) => {
    try {
      const response = await fetch(`/api/v1/summaries/${summaryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }
      const updatedSummaries = summaries.filter((s: any) => s.summary_id !== summaryId);
      // 更新剩余摘要的order_index
      updatedSummaries.forEach((s: any, index: number) => {
        s.order_index = index;
        // 同步更新到服务器
        fetch(`/api/v1/summaries/${s.summary_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_index: s.order_index
          }),
        });
      });
      setSummaries(updatedSummaries);
      if (editingSummaryId === summaryId) {
        setEditingSummaryId(null);
        setEditingSummaryTitle('');
        setEditingSummaryContent('');
      }
      // 更新摘要关键词关联表
      fetchSummaryKeywordLinks();
    } catch (err) {
      console.error('Error deleting summary:', err);
      alert('删除摘要失败');
    }
  };

  // 添加下一个摘要
  const addNextSummary = async (summaryId: string) => {
    if (!documentId) return;
    try {
      // 找到当前摘要
      const currentSummary = summaries.find((s: any) => s.summary_id === summaryId);
      if (!currentSummary) return;
      
      // 计算新摘要的order_index
      const currentOrderIndex = currentSummary.order_index || 0;
      const newOrderIndex = currentOrderIndex + 1;
      
      // 创建新摘要
      const response = await fetch('/api/v1/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: '',
          content: '',
          order_index: newOrderIndex
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create summary');
      }
      const data = await response.json();
      const newSummary = data.data;
      
      // 创建更新后的摘要数组
      const updatedSummaries = [...summaries];
      
      // 找到当前摘要的位置并在其后添加新摘要
      const currentIndex = updatedSummaries.findIndex((s: any) => s.summary_id === summaryId);
      updatedSummaries.splice(currentIndex + 1, 0, newSummary);
      
      // 更新后续摘要的order_index
      updatedSummaries.forEach((s: any, index: number) => {
        // 只更新order_index大于等于新摘要order_index的摘要
        if (s.order_index >= newOrderIndex && s.summary_id !== newSummary.summary_id) {
          s.order_index += 1;
          // 同步更新到服务器
          fetch(`/api/v1/summaries/${s.summary_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_index: s.order_index
            }),
          });
        }
      });
      
      // 按order_index排序后再设置状态
      const sortedSummaries = updatedSummaries.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      setSummaries(sortedSummaries);
      startEditSummary(newSummary);
      // 更新摘要关键词关联表
      fetchSummaryKeywordLinks();
    } catch (err) {
      console.error('Error creating summary:', err);
      alert('创建摘要失败');
    }
  };

  // 一键生成摘要
  const generateSummary = async () => {
    if (!documentId) return;
    try {
      setGeneratingSummary(true);
      const response = await fetch(`/api/v1/summaries/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      const data = await response.json();
      const generatedSummaries = data.data.summaries || [];
      
      // 清除现有的摘要
      setSummaries([]);
      
      // 保存生成的摘要到服务器
      const savedSummaries = [];
      for (let i = 0; i < generatedSummaries.length; i++) {
        const summary = generatedSummaries[i];
        const saveResponse = await fetch('/api/v1/summaries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: documentId,
            title: summary.title,
            content: summary.content,
            order_index: i
          }),
        });
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          savedSummaries.push(saveData.data);
        }
      }
      
      // 重新获取摘要列表和关联表
      await fetchSummaries();
      fetchSummaryKeywordLinks();
    } catch (err) {
      console.error('Error generating summary:', err);
      alert('生成摘要失败');
    } finally {
      setGeneratingSummary(false);
    }
  };

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
      // 构建selected_summaries - 只包含选中的摘要
      const selectedSummaryList = summaries
        .filter(summary => selectedSummaries.has(summary.summary_id))
        .map(summary => ({
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
          selected_summaries: selectedSummaryList
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

  // 一键生成全文
  const generateFullText = async () => {
    if (!documentId) return;
    try {
      // 显示正在生成的消息
      const aiResponse = { 
        role: 'ai' as const, 
        content: '正在生成全文，请稍候...' 
      };
      setChatMessages(prev => [...prev, aiResponse]);
      
      const response = await fetch(`/api/v1/documents/${documentId}/chapters/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate full text');
      }
      
      const data = await response.json();
      
      // 显示生成成功的消息
      const successResponse = { 
        role: 'ai' as const, 
        content: '全文生成成功！' 
      };
      setChatMessages(prev => [...prev, successResponse]);
      
      // 重新获取章节列表
      const chaptersResponse = await fetch(`/api/v1/documents/${documentId}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setChapters(chaptersData.data.chapters || []);
      }
    } catch (error) {
      console.error('Error generating full text:', error);
      const errorResponse = { 
        role: 'ai' as const, 
        content: '生成全文失败，请稍后再试。' 
      };
      setChatMessages(prev => [...prev, errorResponse]);
    }
  };

  // AI帮填摘要
  const assistSummary = async (summaryId: string) => {
    // 找到当前摘要
    const summary = summaries.find((s: any) => s.summary_id === summaryId);
    if (!summary) return;
    
    // 检查摘要状态
    if (summary.title && summary.content) {
      // 标题和内容都不为空，提示无法帮填
      const aiResponse = { 
        role: 'ai' as const, 
        content: '摘要标题和内容都已填写，无法帮填。请清空标题或内容后再尝试。' 
      };
      setChatMessages(prev => [...prev, aiResponse]);
      return;
    }
    
    // 显示正在帮填的消息
    const aiResponse = { 
      role: 'ai' as const, 
      content: '正在帮填摘要，请稍候...' 
    };
    setChatMessages(prev => [...prev, aiResponse]);
    
    try {
      const response = await fetch(`/api/v1/summaries/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          summary_ids: [summaryId]
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to assist summary');
      }
      
      const data = await response.json();
      const updatedSummary = data.data;
      
      // 更新摘要列表
      setSummaries(prev => prev.map((s: any) => 
        s.summary_id === summaryId ? updatedSummary : s
      ));
      
      // 显示帮填成功的消息
      const successResponse = { 
        role: 'ai' as const, 
        content: '摘要帮填成功！' 
      };
      setChatMessages(prev => [...prev, successResponse]);
    } catch (error) {
      console.error('Error assisting summary:', error);
      const errorResponse = { 
        role: 'ai' as const, 
        content: '帮填摘要失败，请稍后再试。' 
      };
      setChatMessages(prev => [...prev, errorResponse]);
    }
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
                        onClick={() => window.location.href = `/document/${doc.document_id}/summary`}
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
                            <option value="申报">申报</option>
                            <option value="临床">临床</option>
                            <option value="总结">总结</option>
                            <option value="其他">其他</option>
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
                </div>
              )}
            </div>
          )}

          {/* 关键词按钮 */}
          <div className="mb-6">
            <a
              href={`/document/${documentId}/keyword`}
              className={`w-full flex items-center p-2 rounded-md hover:bg-green-50 text-gray-800`}
            >
              <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>关键词</span>
            </a>
          </div>
          
          {/* 摘要按钮 */}
          <div className="mb-6">
            <button
              className="w-full flex items-center p-2 rounded-md bg-green-100 text-green-800"
              onClick={() => {
                // 保持在当前摘要页面
              }}
            >
              <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>摘要</span>
            </button>
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
                          className={`p-2 border rounded-md cursor-pointer ${selectedSnapshot === snapshot.version_id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-green-50'}`}
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
                    {summaryKeywordLinks.length > 0 ? (
                      summaryKeywordLinks.map((link: any) => (
                        <div key={link.summary_id} className="p-2 border border-gray-200 rounded-md">
                          <div className="text-xs font-medium text-gray-900 mb-1">{link.summary_title}</div>
                          {link.keywords.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {link.keywords.map((keyword: any) => (
                                <span key={keyword.keyword_id} className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-md">
                                  {keyword.keyword}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">无关联关键词</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-center text-xs text-gray-500">
                        暂无摘要关键词关联
                      </div>
                    )}
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
            {/* 摘要头部 */}
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">摘要管理</h2>
            </div>
            
            {/* 摘要编辑区 */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 128px)' }}>
              <div className="max-w-3xl mx-auto p-6">
                <div className="mb-6">
                  <div className="space-y-4">
                    {summaries.length > 0 ? (
                      summaries
                        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                        .map((summary: any) => (
                          <div
                              key={summary.summary_id}
                              className={`flex items-center block-element ${selectedSummaries.has(summary.summary_id) ? 'bg-green-50 border-green-300' : ''}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', summary.summary_id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedSummaryId = e.dataTransfer.getData('text/plain');
                              if (draggedSummaryId !== summary.summary_id) {
                                // 实现拖动排序逻辑
                                const newSummaries = [...summaries];
                                const draggedIndex = newSummaries.findIndex((s: any) => s.summary_id === draggedSummaryId);
                                const targetIndex = newSummaries.findIndex((s: any) => s.summary_id === summary.summary_id);
                                
                                if (draggedIndex !== -1 && targetIndex !== -1) {
                                  const draggedSummary = newSummaries.splice(draggedIndex, 1)[0];
                                  newSummaries.splice(targetIndex, 0, draggedSummary);
                                  
                                  // 更新所有摘要的order_index
                                  newSummaries.forEach((s: any, index: number) => {
                                    s.order_index = index;
                                  });
                                  
                                  setSummaries(newSummaries);
                                  
                                  // 使用批量更新接口更新摘要顺序
                                  if (documentId) {
                                    const summaryOrders = newSummaries.map((s: any) => ({
                                      summary_id: s.summary_id,
                                      order_index: s.order_index
                                    }));
                                    
                                    fetch(`/api/v1/documents/${documentId}/summaries/order`, {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        document_id: documentId,
                                        summary_orders: summaryOrders
                                      }),
                                    }).catch(err => {
                                      console.error('Error updating summary order:', err);
                                    });
                                  }
                                }
                              }
                            }}
                            onMouseEnter={() => {
                              // 只有在非编辑模式下才设置hoveredSummaryId
                              if (editingSummaryId !== summary.summary_id) {
                                setHoveredSummaryId(summary.summary_id);
                              }
                            }}
                            onMouseLeave={() => setHoveredSummaryId(null)}
                          >
                            {/* 左侧点击选择区域 */}
                            <div 
                              className="w-8 h-8 flex items-center justify-center mr-2 cursor-pointer"
                              onClick={() => {
                                setSelectedSummaries(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(summary.summary_id)) {
                                    newSet.delete(summary.summary_id);
                                  } else {
                                    newSet.add(summary.summary_id);
                                  }
                                  return newSet;
                                });
                              }}
                            >
                              {selectedSummaries.has(summary.summary_id) && (
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
                                {/* 编辑模式 */}
                                {editingSummaryId === summary.summary_id ? (
                                  <div className="flex space-x-4">
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        value={editingSummaryTitle}
                                        onChange={(e) => setEditingSummaryTitle(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                                        onBlur={() => saveSummary(summary.summary_id)}
                                        placeholder="请输入摘要标题"
                                      />
                                    </div>
                                    <div className="flex-2">
                                      <textarea
                                        value={editingSummaryContent}
                                        onChange={(e) => setEditingSummaryContent(e.target.value)}
                                        onBlur={() => saveSummary(summary.summary_id)}
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
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  /* 展示模式 */
                                  <div className="flex space-x-4 cursor-pointer hover:bg-gray-50 p-2 rounded-md" onClick={() => startEditSummary(summary)}>
                                    <div className="flex-1 font-medium text-gray-900 break-words">{summary.title || <span className="text-gray-400">点击此处编辑...</span>}</div>
                                    <div className="flex-2 text-sm text-gray-700 break-words">{summary.content || <span className="text-gray-400">点击此处编辑...</span>}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* 右侧操作按钮 */}
                            <div className="flex flex-col space-y-2 ml-2 sticky top-4">
                              {/* 常驻显示的按钮 */}
                              <div className="flex space-x-2 bg-white p-1 rounded-md shadow-sm">
                                <button 
                                  className="p-1 text-green-600 hover:text-green-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addNextSummary(summary.summary_id);
                                  }}
                                  title="添加下一段"
                                >
                                  <Plus size={16} />
                                </button>
                                <button 
                                  className="p-1 text-red-600 hover:text-red-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSummary(summary.summary_id);
                                  }}
                                  title="删除当前段"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              {/* AI帮填按钮 */}
                              <div className="bg-white p-1 rounded-md shadow-sm">
                                <button 
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    assistSummary(summary.summary_id);
                                  }}
                                  title="AI帮填"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z" fill="currentColor"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12">
                        {generatingSummary ? (
                          <div className="text-center">
                            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-green-200 border-t-green-500 mb-4"></div>
                            <p className="text-gray-600">正在生成摘要，请稍候...</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-500 mb-6">暂无摘要</p>
                            <div className="flex justify-center space-x-4">
                              <button
                                className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600"
                                onClick={generateSummary}
                              >
                                一键生成摘要
                              </button>
                              <button
                                className="px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                                onClick={createSummary}
                              >
                                新增摘要
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 一键生成全文按钮 */}
                <div className="mt-8 text-center">
                  <button
                    className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    onClick={generateFullText}
                  >
                    一键生成全文
                  </button>
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
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="flex items-start justify-end">
                    <div className="bg-purple-50 rounded-lg rounded-tr-none p-3 max-w-[80%]">
                      <p className="text-gray-800 text-sm">{message.content}</p>
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
              {selectedSummaries.size > 0 && (
                <div 
                  className="mb-3 text-xs text-green-600 bg-green-50 p-2 rounded-md cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => setSelectedSummaries(new Set())}
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