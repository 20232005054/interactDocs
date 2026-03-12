import { create } from 'zustand';

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
  paragraphs?: any[];
}

interface ChapterState {
  // 状态
  documentId: string;
  chapterId: string;
  chapters: Chapter[];
  selectedChapter: string | null;
  chapterContent: string | Block[];
  snapshots: any[];
  toc: any[];
  loading: boolean;
  error: string | null;
  expandedChapters: Set<string>;
  selectedBlockId: string | null;
  selectedBlockType: string;
  hoveredBlockId: string | null;
  showAIAssistant: boolean;
  activeAIBlockId: string | null;
  selectedKeywords: string[];
  selectedSummaries: string[];
  selectedParagraphs: Set<string>;
  summaries: any[];
  paragraphKeywordLinks: any[];
  paragraphSummaryLinks: any[];
  
  // 操作
  setDocumentId: (id: string) => void;
  setChapterId: (id: string) => void;
  fetchChapters: (documentId: string) => Promise<void>;
  fetchChapterDetails: (chapterId: string) => Promise<void>;
  selectChapter: (chapterId: string) => Promise<void>;
  toggleChapter: (chapterId: string) => void;
  toggleChapterStatus: (chapterId: string) => Promise<void>;
  addChapter: (documentId: string, title: string, parentId: string | null) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  updateChapterTitle: (chapterId: string, title: string) => Promise<void>;
  addNewParagraph: (chapterId: string) => Promise<void>;
  addNextParagraph: (blockId: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  saveInlineEdit: (block: Block) => Promise<void>;
  changeBlockType: (blockId: string, newType: string) => Promise<void>;
  updateChapterContent: (content?: string | Block[]) => Promise<void>;
  fetchChapterToc: (chapterId: string) => Promise<void>;
  fetchParagraphKeywordLinks: () => Promise<void>;
  fetchParagraphSummaryLinks: () => Promise<void>;
  fetchSummaries: (documentId: string) => Promise<void>;
  fetchSnapshots: (documentId: string) => Promise<void>;
  applySnapshotToChapter: (snapshotId: string) => Promise<void>;
  createSnapshot: (documentId: string, description: string) => Promise<void>;
  generateFullContent: (chapterId: string) => Promise<void>;
  handleAIEvaluate: (chapterId: string, blockId: string, documentTitle: string, documentKeywords: string[]) => Promise<string>;
  handleAIAssist: (chapterId: string, blockId: string, selectedSummaries: string[]) => Promise<string>;
  setSelectedBlockId: (blockId: string | null) => void;
  setSelectedBlockType: (blockType: string) => void;
  setHoveredBlockId: (blockId: string | null) => void;
  setShowAIAssistant: (show: boolean) => void;
  setActiveAIBlockId: (blockId: string | null) => void;
  setSelectedKeywords: (keywords: string[]) => void;
  setSelectedSummaries: (summaries: string[]) => void;
  setSelectedParagraphs: (paragraphs: Set<string>) => void;
}

// 生成唯一ID
const generateId = () => {
  return 'b' + Date.now() + Math.floor(Math.random() * 1000);
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

export const useChapterStore = create<ChapterState>((set, get) => ({
  // 状态初始化
  documentId: '',
  chapterId: '',
  chapters: [],
  selectedChapter: null,
  chapterContent: '',
  snapshots: [],
  toc: [],
  loading: false,
  error: null,
  expandedChapters: new Set(),
  selectedBlockId: null,
  selectedBlockType: 'paragraph',
  hoveredBlockId: null,
  showAIAssistant: false,
  activeAIBlockId: null,
  selectedKeywords: [],
  selectedSummaries: [],
  selectedParagraphs: new Set(),
  summaries: [],
  paragraphKeywordLinks: [],
  paragraphSummaryLinks: [],
  
  // 操作
  setDocumentId: (id: string) => set({ documentId: id }),
  setChapterId: (id: string) => set({ chapterId: id }),
  
  fetchChapters: async (documentId: string) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/documents/${documentId}/chapters`);
      if (!response.ok) {
        throw new Error('Failed to fetch chapters');
      }
      const data = await response.json();
      set({ chapters: data.data.chapters, loading: false });
    } catch (err) {
      console.error('Error fetching chapters:', err);
      set({ error: '获取章节列表失败', loading: false });
    }
  },
  
  fetchChapterDetails: async (chapterId: string) => {
    try {
      set({ loading: true, error: null });
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
        set({ 
          chapterContent: blocks, 
          loading: false 
        });
        get().fetchChapterToc(chapterId);
        
        // 获取段落关联表和摘要列表
        setTimeout(() => {
          get().fetchParagraphKeywordLinks();
          get().fetchParagraphSummaryLinks();
          get().fetchSummaries(get().documentId);
        }, 100);
      }
    } catch (err) {
      console.error('Error fetching chapter details:', err);
      set({ error: '获取章节详情失败', loading: false });
    }
  },
  
  selectChapter: async (chapterId: string) => {
    set({ selectedChapter: chapterId });
    await get().fetchChapterDetails(chapterId);
  },
  
  toggleChapter: (chapterId: string) => {
    set((state) => {
      const newSet = new Set(state.expandedChapters);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return { expandedChapters: newSet };
    });
  },
  
  toggleChapterStatus: async (chapterId: string) => {
    try {
      const chapter = get().chapters.find(c => c.chapter_id === chapterId);
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

      set((state) => ({
        chapters: state.chapters.map(c => 
          c.chapter_id === chapterId ? { ...c, status: newStatus } : c
        )
      }));
    } catch (err) {
      console.error('Error updating chapter status:', err);
      alert('更新章节状态失败');
    }
  },
  
  addChapter: async (documentId: string, title: string, parentId: string | null) => {
    try {
      const response = await fetch('/api/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          title: title.trim(),
          parent_id: parentId,
          order_index: get().chapters.length,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add chapter');
      }

      const data = await response.json();
      set((state) => ({
        chapters: [...state.chapters, data.data]
      }));
    } catch (err) {
      console.error('Error adding chapter:', err);
      alert('添加章节失败');
    }
  },
  
  deleteChapter: async (chapterId: string) => {
    if (!confirm('确定要删除这个章节吗？')) return;

    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }

      set((state) => ({
        chapters: state.chapters.filter(c => c.chapter_id !== chapterId),
        selectedChapter: state.selectedChapter === chapterId ? null : state.selectedChapter,
        chapterContent: state.selectedChapter === chapterId ? '' : state.chapterContent
      }));
    } catch (err) {
      console.error('Error deleting chapter:', err);
      alert('删除章节失败');
    }
  },
  
  updateChapterTitle: async (chapterId: string, title: string) => {
    if (!title.trim()) return;

    try {
      const response = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chapter title');
      }

      await response.json();
      set((state) => ({
        chapters: state.chapters.map(c => 
          c.chapter_id === chapterId ? { ...c, title: title.trim() } : c
        )
      }));
    } catch (err) {
      console.error('Error updating chapter title:', err);
      alert('更新章节标题失败');
    }
  },
  
  addNewParagraph: async (chapterId: string) => {
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/paragraphs`, {
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
      
      set({ chapterContent: [newParagraph] });
      get().fetchChapterToc(chapterId);
    } catch (err) {
      console.error('Error adding new paragraph:', err);
      alert('新增段落失败');
    }
  },
  
  addNextParagraph: async (blockId: string) => {
    const { chapterContent, selectedChapter } = get();
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
        set({ chapterContent: [...chapterContent] });
        await get().updateChapterContent(chapterContent);
      }
      
      // 更新目录
      if (selectedChapter) {
        get().fetchChapterToc(selectedChapter);
      }
    } catch (err) {
      console.error('Error creating paragraph:', err);
      alert('创建段落失败');
    }
  },
  
  deleteBlock: async (blockId: string) => {
    const { chapterContent } = get();
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
        set({ chapterContent: updatedBlocks });
        await get().updateChapterContent(updatedBlocks);
        
        // 更新目录
        const selectedChapter = get().selectedChapter;
        if (selectedChapter) {
          get().fetchChapterToc(selectedChapter);
        }
      }
    } catch (err) {
      console.error('Error deleting paragraph:', err);
      alert('删除段落失败');
    }
  },
  
  saveInlineEdit: async (block: Block) => {
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
      set({ 
        selectedBlockId: null,
        hoveredBlockId: null
      });
      
      // 如果修改的是标题类型的段落，更新目录
      const selectedChapter = get().selectedChapter;
      if (block.type.startsWith('heading') && selectedChapter) {
        get().fetchChapterToc(selectedChapter);
      }
    } catch (err) {
      console.error('Error updating paragraph:', err);
      alert('更新段落失败');
      
      // 重置编辑状态
      set({ 
        selectedBlockId: null,
        hoveredBlockId: null
      });
    }
  },
  
  changeBlockType: async (blockId: string, newType: string) => {
    const { chapterContent } = get();
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
        set({ chapterContent: [...chapterContent] });
        
        // 更新目录
        const selectedChapter = get().selectedChapter;
        if (selectedChapter) {
          get().fetchChapterToc(selectedChapter);
        }
      } catch (err) {
        console.error('Error updating paragraph type:', err);
        alert('更新段落类型失败');
      }
    }
  },
  
  updateChapterContent: async (content?: string | Block[]) => {
    const { selectedChapter, chapterContent } = get();
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
      get().fetchChapterToc(selectedChapter);
      get().fetchParagraphKeywordLinks();
      get().fetchParagraphSummaryLinks();
    } catch (err) {
      console.error('Error updating chapter content:', err);
      alert('更新章节内容失败');
    }
  },
  
  fetchChapterToc: async (chapterId: string) => {
    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/toc`);
      if (!response.ok) {
        throw new Error('Failed to fetch chapter toc');
      }
      const data = await response.json();
      set({ toc: data.data.toc || [] });
    } catch (err) {
      console.error('Error fetching chapter toc:', err);
      set({ toc: [] });
    }
  },
  
  fetchParagraphKeywordLinks: async () => {
    const { selectedChapter, chapterContent } = get();
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
        set({ paragraphKeywordLinks: links });
      }
    } catch (err) {
      console.error('Error fetching paragraph-keyword links:', err);
    }
  },
  
  fetchParagraphSummaryLinks: async () => {
    const { selectedChapter, chapterContent } = get();
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
        set({ paragraphSummaryLinks: links });
      }
    } catch (err) {
      console.error('Error fetching paragraph-summary links:', err);
    }
  },
  
  fetchSummaries: async (documentId: string) => {
    if (!documentId) return;
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/summaries`);
      if (!response.ok) {
        throw new Error('Failed to fetch summaries');
      }
      const data = await response.json();
      set({ summaries: data.data.summaries || [] });
    } catch (err) {
      console.error('Error fetching summaries:', err);
    }
  },
  
  fetchSnapshots: async (documentId: string) => {
    if (!documentId) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots`);
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }
      const data = await response.json();
      set({ snapshots: data.data.snapshots || [] });
    } catch (err) {
      console.error('Error fetching snapshots:', err);
    }
  },
  
  applySnapshotToChapter: async (snapshotId: string) => {
    const { selectedChapter, documentId } = get();
    if (!selectedChapter || !documentId) return;
    
    try {
      // 获取快照详情
      const response = await fetch(`/api/documents/${documentId}/snapshots/detail/${snapshotId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot detail');
      }
      const responseData = await response.json();
      const snapshot = responseData.data;
      
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
      set({ chapterContent: chapterSnapshot.content });
    } catch (err) {
      console.error('Error applying snapshot:', err);
      alert('应用快照失败');
    }
  },
  
  createSnapshot: async (documentId: string, description: string) => {
    if (!documentId || !description.trim()) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create snapshot');
      }

      await response.json();
      // 刷新快照列表
      get().fetchSnapshots(documentId);
    } catch (err) {
      console.error('Error creating snapshot:', err);
      alert('创建快照失败');
    }
  },
  
  generateFullContent: async (chapterId: string) => {
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
      const response = await fetch(`/api/v1/chapters/${chapterId}/paragraphs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapter_id: chapterId,
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
      
      set({ chapterContent: generatedParagraphs });
      get().fetchChapterToc(chapterId);
    } catch (err) {
      console.error('Error generating full content:', err);
      alert('生成全文失败');
    }
  },
  
  handleAIEvaluate: async (chapterId: string, blockId: string, documentTitle: string, documentKeywords: string[]) => {
    const { chapterContent } = get();
    if (!Array.isArray(chapterContent)) return '';

    const selectedBlock = findBlockById(chapterContent, blockId);
    if (!selectedBlock) return '';

    try {
      const response = await fetch(`/api/chapters/${chapterId}/ai/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_title: documentTitle,
          document_keywords: documentKeywords,
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
      return evaluationContent;
    } catch (err) {
      console.error('Error evaluating chapter:', err);
      return 'AI评估失败，请稍后再试';
    }
  },
  
  handleAIAssist: async (chapterId: string, blockId: string, selectedSummaries: string[]) => {
    const { chapterContent } = get();
    if (!Array.isArray(chapterContent)) return '';

    const selectedBlock = findBlockById(chapterContent, blockId);
    if (!selectedBlock) return '';

    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paragraph_id: blockId,
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
        await get().updateChapterContent(Array.isArray(chapterContent) ? chapterContent : []);
        return '好的，现在帮你完成\n\n内容已自动保存';
      } else {
        throw new Error('No content received from AI assist API');
      }
    } catch (err) {
      console.error('Error assisting chapter:', err);
      return `AI帮填失败: ${err instanceof Error ? err.message : '未知错误'}`;
    }
  },
  
  setSelectedBlockId: (blockId: string | null) => set({ selectedBlockId: blockId }),
  setSelectedBlockType: (blockType: string) => set({ selectedBlockType: blockType }),
  setHoveredBlockId: (blockId: string | null) => set({ hoveredBlockId: blockId }),
  setShowAIAssistant: (show: boolean) => set({ showAIAssistant: show }),
  setActiveAIBlockId: (blockId: string | null) => set({ activeAIBlockId: blockId }),
  setSelectedKeywords: (keywords: string[]) => set({ selectedKeywords: keywords }),
  setSelectedSummaries: (summaries: string[]) => set({ selectedSummaries: summaries }),
  setSelectedParagraphs: (paragraphs: Set<string>) => set({ selectedParagraphs: paragraphs }),
}));
