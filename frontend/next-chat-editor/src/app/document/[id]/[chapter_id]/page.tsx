'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, ChevronLeft, Check, Plus, Trash2, Edit3, RefreshCw, Send, History } from 'lucide-react';

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

interface Chapter {
  chapter_id: string;
  document_id: string;
  parent_id: string | null;
  title: string;
  content: string | Block[];
  status: string;
  order_index: number;
  updated_at: string;
}

interface Document {
  document_id: string;
  user_id: string;
  title: string;
  keywords: string[];
  abstract: string | null;
  content: string | null;
  purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ChapterEditor({ params }: { params: Promise<{ id: string; chapter_id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [document, setDocument] = useState<Document | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [showEditChapterModal, setShowEditChapterModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterId, setEditChapterId] = useState<string | null>(null);
  const [parentChapterId, setParentChapterId] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<string | Block[]>('');
  const [aiMode, setAiMode] = useState<'chat' | 'revision'>('chat');
  const [aiMessage, setAiMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string, id?: number}>>([
    { role: 'ai', content: '您好！我是您的AI助手，有什么可以帮助您的吗？' }
  ]);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [selectedBlockType, setSelectedBlockType] = useState<string>('paragraph');
  const [recentDocsExpanded, setRecentDocsExpanded] = useState(true);
  const [docDetailsExpanded, setDocDetailsExpanded] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256); // 默认宽度256px
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320); // 默认宽度320px
  const [isResizing, setIsResizing] = useState<'left' | 'right' | false>(false);
  const [editingDocDetail, setEditingDocDetail] = useState<string | null>(null);
  const [docDetailValue, setDocDetailValue] = useState('');
  const [activeTab, setActiveTab] = useState<'snapshots' | 'related'>('snapshots');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [selectedTocItem, setSelectedTocItem] = useState<string | null>(null);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState<boolean>(false);
  const [activeAIBlockId, setActiveAIBlockId] = useState<string | null>(null);
  const [paragraphKeywordLinks, setParagraphKeywordLinks] = useState<any[]>([]);
  const [paragraphSummaryLinks, setParagraphSummaryLinks] = useState<any[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedSummaries, setSelectedSummaries] = useState<string[]>([]);
  const [selectedParagraphs, setSelectedParagraphs] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<any[]>([]);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  
  // 生成唯一ID
  const generateId = () => {
    return 'b' + Date.now() + Math.floor(Math.random() * 1000);
  };
  
  // 解析params
  useEffect(() => {
    const getParams = async () => {
      try {
        const { id, chapter_id } = await params;
        setDocumentId(id);
        setChapterId(chapter_id);
        setSelectedChapter(chapter_id);
      } catch (err) {
        console.error('Error getting params:', err);
        setError('获取参数失败');
        setLoading(false);
      }
    };
    getParams();
  }, [params]);

  // 处理调整大小的事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      if (isResizing === 'left' && leftSidebarRef.current) {
        // 计算新的左侧边栏宽度
        const newWidth = e.clientX;
        // 限制最小宽度
        if (newWidth >= 200 && newWidth <= 400) {
          // 直接操作DOM，减少状态更新的延迟
          leftSidebarRef.current.style.width = `${newWidth}px`;
        }
      } else if (isResizing === 'right' && rightSidebarRef.current) {
        // 计算新的右侧边栏宽度
        const containerWidth = window.innerWidth;
        const newWidth = containerWidth - e.clientX;
        // 限制最小宽度
        if (newWidth >= 200 && newWidth <= 600) {
          // 直接操作DOM，减少状态更新的延迟
          rightSidebarRef.current.style.width = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizing === 'left' && leftSidebarRef.current) {
        // 当拖动结束时，更新状态以保持一致性
        const computedWidth = parseInt(leftSidebarRef.current.style.width) || 256;
        setLeftSidebarWidth(computedWidth);
      } else if (isResizing === 'right' && rightSidebarRef.current) {
        // 当拖动结束时，更新状态以保持一致性
        const computedWidth = parseInt(rightSidebarRef.current.style.width) || 320;
        setRightSidebarWidth(computedWidth);
      }
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 获取文档信息
  useEffect(() => {
    if (!documentId) return;
    
    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setDocument(data.data);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('获取文档信息失败');
      }
    };

    fetchDocument();
  }, [documentId]);

  // 获取章节列表
  useEffect(() => {
    if (!documentId) return;
    
    const fetchChapters = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/chapters`);
        if (!response.ok) {
          throw new Error('Failed to fetch chapters');
        }
        const data = await response.json();
        setChapters(data.data.chapters);
      } catch (err) {
        console.error('Error fetching chapters:', err);
        setError('获取章节列表失败');
      }
    };

    fetchChapters();
  }, [documentId]);

  // 获取最近文档
  useEffect(() => {
    const fetchRecentDocuments = async () => {
      try {
        const response = await fetch('/api/documents?page=1&page_size=5');
        if (!response.ok) {
          throw new Error('Failed to fetch recent documents');
        }
        const data = await response.json();
        setRecentDocuments(data.data.items);
      } catch (err) {
        console.error('Error fetching recent documents:', err);
      }
    };

    fetchRecentDocuments();
  }, []);

  // 获取当前文档的快照列表
  useEffect(() => {
    const fetchSnapshots = async () => {
      if (!documentId) return;
      
      try {
        const response = await fetch(`/api/documents/${documentId}/snapshots`);
        if (!response.ok) {
          throw new Error('Failed to fetch snapshots');
        }
        const data = await response.json();
        setSnapshots(data.data.snapshots || []);
      } catch (err) {
        console.error('Error fetching snapshots:', err);
      }
    };

    fetchSnapshots();
  }, [documentId]);

  // 加载章节详情
  useEffect(() => {
    if (!chapterId) return;
    
    selectChapter(chapterId);
  }, [chapterId]);

  // 切换章节展开/折叠
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

  // 切换章节状态
  const toggleChapterStatus = async (chapterId: string) => {
    try {
      const chapter = chapters.find(c => c.chapter_id === chapterId);
      if (!chapter) return;

      const newStatus = chapter.status === 'completed' ? 'pending' : 'completed';
      
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chapter status');
      }

      setChapters(prev => prev.map(c => 
        c.chapter_id === chapterId ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      console.error('Error updating chapter status:', err);
      alert('更新章节状态失败');
    }
  };

  // 打开添加章节弹窗
  const openAddChapterModal = (parentId: string | null = null) => {
    setParentChapterId(parentId);
    setNewChapterTitle('');
    setShowAddChapterModal(true);
  };

  // 添加章节
  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;

    try {
      const response = await fetch('/api/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: newChapterTitle.trim(),
          parent_id: parentChapterId,
          order_index: chapters.length,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add chapter');
      }

      const data = await response.json();
      setChapters(prev => [...prev, data.data]);
      setShowAddChapterModal(false);
    } catch (err) {
      console.error('Error adding chapter:', err);
      alert('添加章节失败');
    }
  };

  // 删除章节
  const deleteChapter = async (chapterId: string) => {
    if (!confirm('确定要删除这个章节吗？')) return;

    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }

      setChapters(prev => prev.filter(c => c.chapter_id !== chapterId));
      if (selectedChapter === chapterId) {
        setSelectedChapter(null);
        setChapterContent('');
      }
    } catch (err) {
      console.error('Error deleting chapter:', err);
      alert('删除章节失败');
    }
  };

  // 打开编辑章节弹窗
  const openEditChapterModal = (chapterId: string, currentTitle: string) => {
    setEditChapterId(chapterId);
    setEditChapterTitle(currentTitle);
    setShowEditChapterModal(true);
  };

  // 更新章节标题
  const updateChapterTitle = async () => {
    if (!editChapterId || !editChapterTitle.trim()) return;

    try {
      const response = await fetch(`/api/chapters/${editChapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editChapterTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chapter title');
      }

      await response.json();
      setChapters(prev => prev.map(c => 
        c.chapter_id === editChapterId ? { ...c, title: editChapterTitle.trim() } : c
      ));
      setShowEditChapterModal(false);
    } catch (err) {
      console.error('Error updating chapter title:', err);
      alert('更新章节标题失败');
    }
  };

  // 获取默认快照描述
  const getDefaultSnapshotDescription = async () => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots-meta/default-description`);
      if (!response.ok) {
        throw new Error('Failed to fetch default snapshot description');
      }
      const data = await response.json();
      setSnapshotDescription(data.data.default_description);
    } catch (err) {
      console.error('Error fetching default snapshot description:', err);
      // 如果获取失败，使用默认值
      setSnapshotDescription('');
    }
  };

  // 打开快照弹窗
  const openSnapshotModal = () => {
    getDefaultSnapshotDescription();
    setShowSnapshotModal(true);
  };

  // 刷新快照列表
  const refreshSnapshots = async () => {
    if (!documentId) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots`);
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }
      const data = await response.json();
      setSnapshots(data.data.snapshots || []);
    } catch (err) {
      console.error('Error fetching snapshots:', err);
    }
  };

  // 获取快照详情
  const getSnapshotDetail = async (snapshotId: string) => {
    if (!documentId) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots/detail/${snapshotId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch snapshot detail');
    }
    const responseData = await response.json();
    return responseData.data;
    } catch (err) {
      console.error('Error fetching snapshot detail:', err);
      return null;
    }
  };

  // 应用快照到当前章节
  const applySnapshotToChapter = async (snapshotId: string) => {
    if (!selectedChapter) return;
    
    setSelectedSnapshot(snapshotId);
    
    const snapshot = await getSnapshotDetail(snapshotId);
    if (!snapshot) {
      alert('获取快照详情失败');
      return;
    }
    
    // 从快照数据中找到当前章节的内容
    const chapterSnapshot = snapshot.snapshot_data.chapters.find((ch: any) => ch.chapter_id === selectedChapter);
    if (!chapterSnapshot) {
      alert('快照中未找到当前章节的内容');
      return;
    }
    
    // 应用快照内容到当前章节
    setChapterContent(chapterSnapshot.content);
  };

  // 一键生成全文
  const generateFullContent = async () => {
    if (!selectedChapter) return;
    
    try {
      // 这里可以调用AI生成全文的API
      // 暂时创建一些示例内容
      const sampleContent = [
        {
          id: generateId(),
          type: 'heading-1',
          content: '章节标题',
          order_index: 0,
          metadata: {}
        },
        {
          id: generateId(),
          type: 'paragraph',
          content: '这是一个示例段落，用于展示一键生成全文功能。您可以根据需要修改这里的内容。',
          order_index: 1,
          metadata: {}
        },
        {
          id: generateId(),
          type: 'heading-2',
          content: '子章节标题',
          order_index: 2,
          metadata: {}
        },
        {
          id: generateId(),
          type: 'paragraph',
          content: '这是子章节的内容，展示了如何使用不同级别的标题和段落。',
          order_index: 3,
          metadata: {}
        }
      ];
      
      // 保存到服务器
      const response = await fetch(`/api/v1/chapters/${selectedChapter}/paragraphs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapter_id: selectedChapter,
          paragraphs: sampleContent.map((block, index) => ({
            content: block.content,
            para_type: block.type,
            order_index: index
          }))
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content');
      }
      
      const data = await response.json();
      const generatedParagraphs = data.data.paragraphs.map((p: any) => ({
        id: p.paragraph_id,
        type: p.para_type,
        content: p.content,
        order_index: p.order_index,
        metadata: {}
      }));
      
      setChapterContent(generatedParagraphs);
      fetchChapterToc(selectedChapter);
    } catch (err) {
      console.error('Error generating full content:', err);
      alert('生成全文失败');
    }
  };

  // 新增段落
  const addNewParagraph = async () => {
    if (!selectedChapter) return;
    
    try {
      const response = await fetch(`/api/v1/chapters/${selectedChapter}/paragraphs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '',
          para_type: 'paragraph',
          order_index: 0
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create paragraph');
      }
      
      const data = await response.json();
      const newParagraph = {
        id: data.data.paragraph_id,
        type: data.data.para_type,
        content: data.data.content,
        order_index: data.data.order_index,
        metadata: {}
      };
      
      setChapterContent([newParagraph]);
      fetchChapterToc(selectedChapter);
    } catch (err) {
      console.error('Error adding new paragraph:', err);
      alert('新增段落失败');
    }
  };

  // 打开回退确认模态框
  const openRollbackModal = () => {
    if (!selectedChapter) return;
    const isEmpty = Array.isArray(chapterContent) ? chapterContent.length === 0 : chapterContent.trim() === '';
    if (isEmpty) return;
    setShowRollbackModal(true);
  };

  // 执行回退操作
  const confirmRollback = async () => {
    setShowRollbackModal(false);
    
    // 从最近的快照中恢复内容
    if (snapshots.length > 0) {
      // 按创建时间排序，找到最近的快照
      const sortedSnapshots = [...snapshots].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const latestSnapshot = sortedSnapshots[0];
      if (latestSnapshot) {
        // 获取最近快照的详情
        const snapshotDetail = await getSnapshotDetail(latestSnapshot.version_id);
        if (snapshotDetail) {
          // 从快照数据中找到当前章节的内容
          const chapterSnapshot = snapshotDetail.snapshot_data.chapters.find((ch: any) => ch.chapter_id === selectedChapter);
          if (chapterSnapshot) {
            // 应用快照内容到当前章节
            setChapterContent(chapterSnapshot.content);
            return;
          }
        }
      }
    }
    
    // 如果没有快照，清空内容
    setChapterContent('');
  };

  // 创建快照
  const createSnapshot = async () => {
    if (!documentId || !snapshotDescription.trim()) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: snapshotDescription.trim() }),
    });

    if (!response.ok) {
      throw new Error('Failed to create snapshot');
    }

    await response.json();
    setShowSnapshotModal(false);
    setSnapshotDescription('');
    // 刷新快照列表
    refreshSnapshots();
    } catch (err) {
      console.error('Error creating snapshot:', err);
      alert('创建快照失败');
    }
  };

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
      
      // 移除事件监听器
      if ((window as any).editEventListeners) {
        window.document.removeEventListener('click', (window as any).editEventListeners.click, true);
        window.document.removeEventListener('keydown', (window as any).editEventListeners.keydown, true);
        (window as any).editEventListeners = null;
      }
      
      // 重置hover状态
      setHoveredBlockId(null);
      
      // 如果修改的是标题类型的段落，更新目录
      if (block.type.startsWith('heading') && selectedChapter) {
        fetchChapterToc(selectedChapter);
      }
    } catch (err) {
      console.error('Error updating paragraph:', err);
      alert('更新段落失败');
      
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
    }
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

  // 递归查找并删除块
  const findAndDeleteBlock = (blocks: Block[], blockId: string): boolean => {
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].id === blockId) {
        blocks.splice(i, 1);
        return true;
      }
      const children = blocks[i].children;
      if (children && Array.isArray(children) && children.length > 0) {
        if (findAndDeleteBlock(children, blockId)) {
          return true;
        }
      }
    }
    return false;
  };

  // 查找块
  const findBlockById = (blocks: Block[], blockId: string): Block | null => {
    for (const block of blocks) {
      if (block.id === blockId) {
        return block;
      }
      if (block.children && Array.isArray(block.children)) {
        const found = findBlockById(block.children, blockId);
        if (found) {
          return found;
        }
      }
    }
    return null;
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
        setChapterContent([...chapterContent]);
        
        // 更新目录
        if (selectedChapter) {
          fetchChapterToc(selectedChapter);
        }
      } catch (err) {
        console.error('Error updating paragraph type:', err);
        alert('更新段落类型失败');
      }
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
        setChapterContent([...chapterContent]);
        await updateChapterContent(chapterContent);
      }
      
      // 更新目录
      if (selectedChapter) {
        fetchChapterToc(selectedChapter);
      }
    } catch (err) {
      console.error('Error creating paragraph:', err);
      alert('创建段落失败');
    }
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
        setChapterContent(updatedBlocks);
        await updateChapterContent(updatedBlocks);
        
        // 更新目录
        if (selectedChapter) {
          fetchChapterToc(selectedChapter);
        }
      }
    } catch (err) {
      console.error('Error deleting paragraph:', err);
      alert('删除段落失败');
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
                
                setChapterContent(newBlocks);
                
                // 使用批量更新接口更新段落顺序
                if (selectedChapter) {
                  const paragraphOrders = newBlocks.map(block => ({
                    paragraph_id: block.id,
                    order_index: block.order_index
                  }));
                  
                  fetch(`/api/v1/chapters/${selectedChapter}/paragraphs/order`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ paragraph_orders: paragraphOrders }),
                  }).catch(err => {
                    console.error('Error updating paragraph order:', err);
                  });
                }
                
                // 更新章节内容到服务器
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
        {/* 左侧点击选择区域 */}
        <div 
          className="w-8 h-8 flex items-center justify-center mr-2 cursor-pointer"
          onClick={() => {
            setSelectedParagraphs(prev => {
              const newSet = new Set(prev);
              if (newSet.has(block.id)) {
                newSet.delete(block.id);
              } else {
                newSet.add(block.id);
              }
              return newSet;
            });
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
                    {document?.keywords && document.keywords.length > 0 ? (
                      document.keywords.map((keyword, index) => (
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
                    handleAIEvaluate();
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
                    handleAIAssist();
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

  // 获取章节目录
  const fetchChapterToc = async (chapterId: string) => {
    console.log('Fetching TOC for chapter:', chapterId);
    if (!chapterId) return;
    
    try {
      console.log('Sending request to:', `/api/v1/chapters/${chapterId}/toc`);
      const response = await fetch(`/api/v1/chapters/${chapterId}/toc`);
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch chapter toc');
      }
      const data = await response.json();
      console.log('TOC data:', data);
      setToc(data.data.toc || []);
      setSelectedTocItem(null);
    } catch (err) {
      console.error('Error fetching chapter toc:', err);
      setToc([]);
    }
  };

  // 获取段落关键词关联表
  const fetchParagraphKeywordLinks = async () => {
    if (!selectedChapter) return;
    try {
      // 从章节内容中获取所有段落ID
      const getParagraphIds = (blocks: Block[]): string[] => {
        const ids: string[] = [];
        for (const block of blocks) {
          ids.push(block.id);
          if (block.children && Array.isArray(block.children)) {
            ids.push(...getParagraphIds(block.children));
          }
        }
        return ids;
      };

      if (Array.isArray(chapterContent)) {
        const paragraphIds = getParagraphIds(chapterContent);
        const links = [];
        
        // 对每个段落获取关联的关键词
        for (const paragraphId of paragraphIds) {
          const keywordsResponse = await fetch(`/api/v1/paragraphs/${paragraphId}/keywords`);
          if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            const keywords = keywordsData.data.keywords || [];
            links.push({
              paragraph_id: paragraphId,
              keywords: keywords
            });
          }
        }
        setParagraphKeywordLinks(links);
      }
    } catch (err) {
      console.error('Error fetching paragraph-keyword links:', err);
    }
  };

  // 获取摘要列表
  const fetchSummaries = async () => {
    if (!documentId) return;
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const data = await response.json();
      setSummaries(data.data.summaries || []);
    } catch (err) {
      console.error('Error fetching summaries:', err);
    }
  };

  // 获取段落摘要关联表
  const fetchParagraphSummaryLinks = async () => {
    if (!selectedChapter) return;
    try {
      // 从章节内容中获取所有段落ID
      const getParagraphIds = (blocks: Block[]): string[] => {
        const ids: string[] = [];
        for (const block of blocks) {
          ids.push(block.id);
          if (block.children && Array.isArray(block.children)) {
            ids.push(...getParagraphIds(block.children));
          }
        }
        return ids;
      };

      if (Array.isArray(chapterContent)) {
        const paragraphIds = getParagraphIds(chapterContent);
        const links = [];
        
        // 对每个段落获取关联的摘要
        for (const paragraphId of paragraphIds) {
          const summariesResponse = await fetch(`/api/v1/paragraphs/${paragraphId}/summaries`);
          if (summariesResponse.ok) {
            const summariesData = await summariesResponse.json();
            const summaries = summariesData.data.summaries || [];
            links.push({
              paragraph_id: paragraphId,
              summaries: summaries
            });
          }
        }
        setParagraphSummaryLinks(links);
      }
    } catch (err) {
      console.error('Error fetching paragraph-summary links:', err);
    }
  };

  // 选择章节
  const selectChapter = async (chapterId: string) => {
    setSelectedChapter(chapterId);
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chapter details');
      }
      const data = await response.json();
      const chapter = data.data;
      if (chapter) {
        // 转换后端返回的paragraphs为前端的Block格式
        const blocks = chapter.paragraphs.map((p: any) => ({
          id: p.paragraph_id,
          type: p.para_type,
          content: p.content,
          order_index: p.order_index,
          metadata: {
            ai_eval: p.ai_eval,
            ai_suggestion: p.ai_suggestion,
            ai_generate: p.ai_generate,
            ischange: p.ischange
          }
        }));
        
        // 按order_index排序
        blocks.sort((a: any, b: any) => a.order_index - b.order_index);
        setChapterContent(blocks);
        fetchChapterToc(chapterId);
        setSelectedBlockId(null);
        setSelectedBlockType('paragraph');
        
        // 获取段落关联表和摘要列表
        setTimeout(() => {
          fetchParagraphKeywordLinks();
          fetchParagraphSummaryLinks();
          fetchSummaries();
        }, 100);
      }
    } catch (err) {
      console.error('Error fetching chapter details:', err);
      alert('获取章节详情失败');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // 选择段落时更新类型
  const handleSelectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    if (Array.isArray(chapterContent)) {
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

  // 更新章节内容
  const updateChapterContent = async (content?: string | Block[]) => {
    if (!selectedChapter) return;

    const contentToSave = content || chapterContent;

    try {
      // 转换前端Block格式为后端Paragraph格式
      const paragraphs = Array.isArray(contentToSave) ? contentToSave.map(block => ({
        paragraph_id: block.id,
        para_type: block.type,
        content: block.content
      })) : [];

      const response = await fetch(`/api/v1/chapters/${selectedChapter}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paragraphs }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chapter content');
      }

      // 更新章节内容后重新获取目录和关联表
      fetchChapterToc(selectedChapter);
      fetchParagraphKeywordLinks();
      fetchParagraphSummaryLinks();
    } catch (err) {
      console.error('Error updating chapter content:', err);
      alert('更新章节内容失败');
    }
  };

  // AI评估
  const handleAIEvaluate = async () => {
    if (!selectedChapter || !selectedBlockId) return;

    // 查找选中的块
    const findBlockById = (blocks: Block[], blockId: string): Block | null => {
      for (const block of blocks) {
        if (block.id === blockId) {
          return block;
        }
        if (block.children && Array.isArray(block.children)) {
          const found = findBlockById(block.children, blockId);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const selectedBlock = Array.isArray(chapterContent) ? findBlockById(chapterContent, selectedBlockId) : null;
    if (!selectedBlock) return;

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: '请帮我AI评估该段落' };
    setChatMessages(prev => [...prev, newUserMessage]);

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '', id: aiMessageId }]);

    try {
      const response = await fetch(`/api/chapters/${selectedChapter}/ai/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_title: document?.title || '',
          document_keywords: document?.keywords || [],
          paragraph_title: selectedBlock.type.startsWith('heading') ? selectedBlock.content : '',
          paragraph_content: selectedBlock.type === 'paragraph' ? selectedBlock.content : ''
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to evaluate chapter');
      }

      const data = await response.json();
      // 组合评估内容和建议
      let evaluationContent = data.data.evaluation;
      if (data.data.suggestions && data.data.suggestions.length > 0) {
        evaluationContent += '\n\n### 改进建议\n\n';
        data.data.suggestions.forEach((suggestion: string, index: number) => {
          evaluationContent += `${index + 1}. ${suggestion}\n\n`;
        });
      }
      // 更新AI消息
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: evaluationContent } : msg
      ));
    } catch (err) {
      console.error('Error evaluating chapter:', err);
      // 更新错误消息
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: 'AI评估失败，请稍后再试' } : msg
      ));
    }
  };

  // AI帮填
  const handleAIAssist = async () => {
    if (!selectedChapter || !selectedBlockId) return;

    // 查找选中的块
    const findBlockById = (blocks: Block[], blockId: string): Block | null => {
      for (const block of blocks) {
        if (block.id === blockId) {
          return block;
        }
        if (block.children && Array.isArray(block.children)) {
          const found = findBlockById(block.children, blockId);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const selectedBlock = Array.isArray(chapterContent) ? findBlockById(chapterContent, selectedBlockId) : null;
    if (!selectedBlock) return;

    // 检查段落内容是否为空
    const isEmpty = selectedBlock.type === 'paragraph' ? !selectedBlock.content : selectedBlock.children?.length === 0;
    if (!isEmpty) {
      // 段落不为空，显示提示消息
      const newUserMessage = { role: 'user' as const, content: '帮我AI填写内容' };
      setChatMessages(prev => [...prev, newUserMessage]);
      const aiMessageId = Date.now();
      setChatMessages(prev => [...prev, { role: 'ai' as const, content: '段落不为空，不能AI帮填', id: aiMessageId }]);
      return;
    }

    // 添加用户消息到聊天记录
    const newUserMessage = { role: 'user' as const, content: '帮我AI填写内容' };
    setChatMessages(prev => [...prev, newUserMessage]);

    // 添加一个临时的AI消息占位符
    const aiMessageId = Date.now();
    setChatMessages(prev => [...prev, { role: 'ai' as const, content: '好的，现在帮你完成', id: aiMessageId }]);

    try {
      const response = await fetch(`/api/v1/chapters/${selectedChapter}/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paragraph_id: selectedBlockId,
          summary_sections: selectedSummaries
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to assist chapter: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';
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
              if (json.content) {
                // 累加响应内容
                fullContent += json.content;
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
            // 流结束
          } else {
            try {
              const json = JSON.parse(jsonStr);
              if (json.content) {
                // 累加响应内容
                fullContent += json.content;
              }
            } catch (e) {
              console.error('Error parsing streaming response:', e);
            }
          }
        }
      }

      if (fullContent) {
        // 更新段落内容
        if (selectedBlock.type === 'paragraph') {
          selectedBlock.content = fullContent;
        } else if (selectedBlock.children) {
          selectedBlock.children.push({
            id: generateId(),
            type: 'paragraph',
            content: fullContent,
            metadata: {}
          });
        }
        // 自动保存章节内容
        await updateChapterContent(Array.isArray(chapterContent) ? chapterContent : []);
        // 更新AI消息
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: '好的，现在帮你完成\n\n内容已自动保存' } : msg
        ));
      } else {
        throw new Error('No content received from AI assist API');
      }
    } catch (err) {
      console.error('Error assisting chapter:', err);
      // 更新错误消息
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: `AI帮填失败: ${err instanceof Error ? err.message : '未知错误'}` } : msg
      ));
    }
  };

  // 应用修订内容
  const applyRevision = async (paragraphId: string, revisedContent: string) => {
    if (!Array.isArray(chapterContent)) return;

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
        setChapterContent([...chapterContent]);
        
        // 自动保存章节内容
        await updateChapterContent(chapterContent);
      } catch (err) {
        console.error('Error applying revision:', err);
      }
    }
  };

  // 发送AI消息
  const sendAIMessage = async () => {
    if (!aiMessage.trim() || !selectedChapter) return;

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
          const block = findBlockById(chapterContent, blockId);
          return {
            paragraph_id: blockId,
            content: block && typeof block.content === 'string' ? block.content : ''
          };
        }).filter(item => item.content) : [];

        // 构建selected_keywords
        const formattedSelectedKeywords = document?.keywords ? document.keywords.filter(keyword => selectedKeywords.includes(keyword)).map(keyword => ({
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
      } else {
        // 构建selected_paragraphs - 只包含选中的段落
        const selectedParagraphList = Array.isArray(chapterContent) ? Array.from(selectedParagraphs).map(blockId => {
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
            chapter_id: selectedChapter,
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

  // 更新文档信息
  const updateDocumentInfo = async (field: string, value: string | string[]) => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
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
      .filter(chapter => chapter.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .map(chapter => {
        const isExpanded = expandedChapters.has(chapter.chapter_id);
        const hasChildren = chapters.some(c => c.parent_id === chapter.chapter_id);

        return (
          <div key={chapter.chapter_id} className="mb-1">
            <div 
              className={`flex items-center p-2 rounded-md cursor-pointer ${selectedChapter === chapter.chapter_id ? 'bg-green-100 text-green-800' : 'hover:bg-green-50 text-gray-800'}`}
              onClick={() => {
                // 跳转到章节页面
                window.location.href = `/document/${documentId}/${chapter.chapter_id}`;
              }}
              title={chapter.title}
            >
              {!leftSidebarCollapsed && hasChildren && (
                <button 
                  className={`mr-2 ${selectedChapter === chapter.chapter_id ? 'text-green-800' : 'text-green-600'}`} 
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
                    className={`${selectedChapter === chapter.chapter_id ? 'text-green-800' : 'text-green-600'} hover:text-green-800`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChapterStatus(chapter.chapter_id);
                    }}
                  >
                    {chapter.status === 'completed' ? <Check size={16} /> : <Edit3 size={16} />}
                  </button>
                  <button 
                    className={`${selectedChapter === chapter.chapter_id ? 'text-green-800' : 'text-green-600'} hover:text-green-800`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditChapterModal(chapter.chapter_id, chapter.title);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    className={`${selectedChapter === chapter.chapter_id ? 'text-green-800' : 'text-green-600'} hover:text-green-800`}
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
                    {recentDocuments.map(doc => (
                      <div 
                        key={doc.document_id}
                        className={`p-2 rounded-md text-sm cursor-pointer ${doc.document_id === documentId ? 'bg-green-100 text-green-800' : 'hover:bg-gray-100 text-gray-800'}`}
                        onClick={async () => {
                          // 对于不同的文档，跳转到该文档的第一个章节
                          if (doc.document_id !== documentId) {
                            try {
                              // 获取目标文档的章节列表
                              const response = await fetch(`/api/documents/${doc.document_id}/chapters`);
                              if (response.ok) {
                                const data = await response.json();
                                const chapters = data.data.chapters;
                                if (chapters && chapters.length > 0) {
                                  // 跳转到第一个章节
                                  window.location.href = `/document/${doc.document_id}/${chapters[0].chapter_id}`;
                                } else {
                                  // 如果没有章节，跳转到文档首页
                                  window.location.href = `/document/${doc.document_id}`;
                                }
                              } else {
                                // 如果获取章节失败，跳转到文档首页
                                window.location.href = `/document/${doc.document_id}`;
                              }
                            } catch (error) {
                              // 如果发生错误，跳转到文档首页
                              window.location.href = `/document/${doc.document_id}`;
                            }
                          }
                        }}
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
              className="w-full flex items-center p-2 rounded-md hover:bg-green-50 text-gray-800"
              onClick={() => {
                // 跳转到摘要页面
                window.location.href = `/document/${documentId}/summary`;
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
                      snapshots.map(snapshot => (
                        <div 
                          key={snapshot.version_id} 
                          className={`p-2 border rounded-md cursor-pointer ${selectedSnapshot === snapshot.version_id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-green-50'}`}
                          onClick={() => applySnapshotToChapter(snapshot.version_id)}
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
                  <div className="space-y-4">
                    {/* 段落关键词关联表 */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">段落关键词关联</h4>
                      {paragraphKeywordLinks.length > 0 ? (
                        <div className="space-y-2">
                          {paragraphKeywordLinks.map((link: any) => {
                            // 找到段落内容
                            const findBlockById = (blocks: Block[], blockId: string): Block | null => {
                              for (const block of blocks) {
                                if (block.id === blockId) {
                                  return block;
                                }
                                if (block.children && Array.isArray(block.children)) {
                                  const found = findBlockById(block.children, blockId);
                                  if (found) {
                                    return found;
                                  }
                                }
                              }
                              return null;
                            };
                            const block = Array.isArray(chapterContent) ? findBlockById(chapterContent, link.paragraph_id) : null;
                            const blockContent = block ? (typeof block.content === 'string' ? block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '') : '无内容') : '未找到段落';
                            
                            return (
                              <div key={link.paragraph_id} className="p-2 border border-gray-200 rounded-md">
                                <div className="text-xs font-medium text-gray-900 mb-1">{blockContent}</div>
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
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2 text-center text-xs text-gray-500 border border-gray-200 rounded-md">
                          暂无段落关键词关联
                        </div>
                      )}
                    </div>
                    
                    {/* 段落摘要关联表 */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">段落摘要关联</h4>
                      {paragraphSummaryLinks.length > 0 ? (
                        <div className="space-y-2">
                          {paragraphSummaryLinks.map((link: any) => {
                            // 找到段落内容
                            const findBlockById = (blocks: Block[], blockId: string): Block | null => {
                              for (const block of blocks) {
                                if (block.id === blockId) {
                                  return block;
                                }
                                if (block.children && Array.isArray(block.children)) {
                                  const found = findBlockById(block.children, blockId);
                                  if (found) {
                                    return found;
                                  }
                                }
                              }
                              return null;
                            };
                            const block = Array.isArray(chapterContent) ? findBlockById(chapterContent, link.paragraph_id) : null;
                            const blockContent = block ? (typeof block.content === 'string' ? block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '') : '无内容') : '未找到段落';
                            
                            return (
                              <div key={link.paragraph_id} className="p-2 border border-gray-200 rounded-md">
                                <div className="text-xs font-medium text-gray-900 mb-1">{blockContent}</div>
                                {link.summaries.length > 0 ? (
                                  <div className="space-y-1">
                                    {link.summaries.map((summary: any) => (
                                      <div key={summary.summary_id} className="text-xs text-blue-600">
                                        {summary.title}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">无关联摘要</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2 text-center text-xs text-gray-500 border border-gray-200 rounded-md">
                          暂无段落摘要关联
                        </div>
                      )}
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
          
          {/* 工具栏 */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-gray-900">
                  {chapters.find(c => c.chapter_id === selectedChapter)?.title || '章节编辑'}
                </h1>
                <div className="flex space-x-2">
                  <button 
                    className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                    onClick={openSnapshotModal}
                  >
                    快照
                  </button>
                  <button 
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm"
                    onClick={openRollbackModal}
                  >
                    回退
                  </button>
                </div>
              </div>
              {selectedBlockId && (
                <div className="flex space-x-2">
                  <button 
                    className={`px-2 py-1 rounded-md text-sm ${selectedBlockType === 'paragraph' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}
                    onClick={() => selectedBlockId && changeBlockType(selectedBlockId, 'paragraph')}
                  >
                    正文
                  </button>
                  <button 
                    className={`px-2 py-1 rounded-md text-sm ${selectedBlockType === 'heading-1' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}
                    onClick={() => selectedBlockId && changeBlockType(selectedBlockId, 'heading-1')}
                  >
                    标题1
                  </button>
                  <button 
                    className={`px-2 py-1 rounded-md text-sm ${selectedBlockType === 'heading-2' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}
                    onClick={() => selectedBlockId && changeBlockType(selectedBlockId, 'heading-2')}
                  >
                    标题2
                  </button>
                  <button 
                    className={`px-2 py-1 rounded-md text-sm ${selectedBlockType === 'heading-3' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}
                    onClick={() => selectedBlockId && changeBlockType(selectedBlockId, 'heading-3')}
                  >
                    标题3
                  </button>
                  <button 
                    className={`px-2 py-1 rounded-md text-sm ${selectedBlockType === 'list' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}
                    onClick={() => selectedBlockId && changeBlockType(selectedBlockId, 'list')}
                  >
                    列表
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* 编辑区 */}
          <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            <div className="max-w-3xl mx-auto">
              {Array.isArray(chapterContent) ? (
                chapterContent.length > 0 ? (
                  chapterContent.map((block) => renderBlockContent(block))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p className="mb-6">章节内容为空，请开始编辑</p>
                    <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                      <button 
                        className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm"
                        onClick={addNewParagraph}
                      >
                        新增段落
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-6">章节内容为空，请开始编辑</p>
                  <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <button 
                      className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm"
                      onClick={addNewParagraph}
                    >
                      新增段落
                    </button>
                  </div>
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
                        <ReactMarkdown>{typeof message.content === 'string' ? message.content : ''}</ReactMarkdown>
                      </div>
                      {/* 修订模式的应用按钮 */}
                      {message.isRevision && message.paragraphId && (
                        <div className="mt-3 flex space-x-2">
                          <button
                            className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600"
                            onClick={() => applyRevision(message.paragraphId, message.content)}
                          >
                            应用修订
                          </button>
                        </div>
                      )}
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

          {/* 模式切换 */}
          {!rightSidebarCollapsed && (
            <div className="p-2 border-t border-gray-200">
              <div className="flex space-x-2">
                <button 
                  className={`flex-1 py-1 text-center text-sm font-medium rounded-md ${aiMode === 'chat' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
                  onClick={() => setAiMode('chat')}
                >
                  Chat模式
                </button>
                <button 
                  className={`flex-1 py-1 text-center text-sm font-medium rounded-md ${aiMode === 'revision' ? 'text-white bg-green-500' : 'text-gray-600 bg-gray-100'}`}
                  onClick={() => setAiMode('revision')}
                >
                  修订模式
                </button>
              </div>
            </div>
          )}

          {/* 输入区域 */}
          {!rightSidebarCollapsed && (
            <div className="p-4 border-t border-gray-200">
              {/* 选中提示 */}
              {selectedParagraphs.size > 0 && (
                <div 
                  className="mb-3 text-xs text-green-600 bg-green-50 p-2 rounded-md cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => setSelectedParagraphs(new Set())}
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
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 ${aiMode === 'revision' && selectedParagraphs.size !== 1 ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  placeholder={aiMode === 'chat' ? '输入消息...' : (selectedParagraphs.size === 1 ? '输入修订指令...' : '请选择一个段落进行修订')}
                  disabled={aiMode === 'revision' && selectedParagraphs.size !== 1}
                />
                <button 
                  className={`p-2 rounded-md ${aiMode === 'revision' && selectedParagraphs.size !== 1 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}`}
                  onClick={sendAIMessage}
                  disabled={aiMode === 'revision' && selectedParagraphs.size !== 1}
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

      {/* 快照弹窗 */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              创建快照
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                快照描述
              </label>
              <input
                type="text"
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                placeholder="请输入快照描述"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowSnapshotModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button 
                onClick={createSnapshot}
                className="px-4 py-2 text-white bg-green-500 rounded-md hover:bg-green-600"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 回退确认弹窗 */}
      {showRollbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              确认回退
            </h3>
            <p className="mb-4 text-gray-600">
              确定要回退到最近的快照吗？当前未保存的更改将丢失。
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowRollbackModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button 
                onClick={confirmRollback}
                className="px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600"
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