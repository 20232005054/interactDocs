'use client';

import { useState, useEffect, useRef } from 'react';
import LeftSidebar from '../../../components/LeftSidebar';
import { CoreEditor } from '../../../components/CoreEditor';
import RightSidebar from '../../../components/RightSidebar';
import { useDocumentStore } from '../../../store/documentStore';
import { useChapterStore } from '../../../store/chapterStore';

export default function DocumentEditor({ params }: { params: Promise<{ id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256); // 默认宽度256px
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320); // 默认宽度320px
  const [isResizing, setIsResizing] = useState<'left' | 'right' | false>(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [selectedParagraphs, setSelectedParagraphs] = useState<Array<{paragraph_id: string, content: string}>>([]);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);

  const {
    document,
    loading,
    error,
    fetchDocument,
    fetchSnapshots,
    createSnapshot,
    getDefaultSnapshotDescription
  } = useDocumentStore();

  const {
    chapters,
    selectedChapter,
    selectChapter,
    fetchChapters
  } = useChapterStore();

  // 解析params
  useEffect(() => {
    const getDocumentId = async () => {
      try {
        const { id } = await params;
        setDocumentId(id);
      } catch (err) {
        console.error('Error getting document id:', err);
      }
    };
    getDocumentId();
  }, [params]);

  // 获取文档信息和章节列表
  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
      fetchChapters(documentId);
      fetchSnapshots(documentId);
    }
  }, [documentId, fetchDocument, fetchChapters, fetchSnapshots]);

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

  // 切换章节状态
  const toggleChapterStatus = async (chapterId: string) => {
    try {
      const chapter = chapters.find(c => c.chapter_id === chapterId);
      if (!chapter) return;

      const newStatus = chapter.status === 'completed' ? 'pending' : 'completed';
      // 由于updateChapterStatus方法已移除，这里需要调用正确的API来更新章节状态
      try {
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
        // 重新获取章节列表以更新状态
        fetchChapters(documentId);
      } catch (err) {
        console.error('Error updating chapter status:', err);
        alert('更新章节状态失败');
      }
    } catch (err) {
      console.error('Error updating chapter status:', err);
      alert('更新章节状态失败');
    }
  };

  // 获取默认快照描述
  const fetchDefaultSnapshotDescription = async () => {
    if (!documentId) return;

    try {
      const description = await getDefaultSnapshotDescription(documentId);
      setSnapshotDescription(description);
    } catch (err) {
      console.error('Error fetching default snapshot description:', err);
      setSnapshotDescription('');
    }
  };

  // 打开快照弹窗
  const openSnapshotModal = () => {
    fetchDefaultSnapshotDescription();
    setShowSnapshotModal(true);
  };

  // 创建快照
  const handleCreateSnapshot = async () => {
    if (!documentId || !snapshotDescription.trim()) return;

    try {
      await createSnapshot(documentId, snapshotDescription);
      setShowSnapshotModal(false);
      setSnapshotDescription('');
    } catch (err) {
      console.error('Error creating snapshot:', err);
      alert('创建快照失败');
    }
  };

  // 打开回退确认模态框
  const openRollbackModal = () => {
    if (!selectedChapter) return;
    setShowRollbackModal(true);
  };

  // 执行回退操作
  const confirmRollback = async () => {
    setShowRollbackModal(false);
    // 这里可以实现回退逻辑
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
        <LeftSidebar 
          documentId={documentId}
          leftSidebarCollapsed={leftSidebarCollapsed}
          setLeftSidebarCollapsed={setLeftSidebarCollapsed}
          leftSidebarWidth={leftSidebarWidth}
        />

        {/* 中间核心编辑区 */}
        <CoreEditor 
          documentId={documentId}
          selectedChapter={selectedChapter}
          leftSidebarCollapsed={leftSidebarCollapsed}
          rightSidebarCollapsed={rightSidebarCollapsed}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
        />

        {/* 右侧AI对话区 */}
        <RightSidebar 
          documentId={documentId}
        />
      </div>



      {/* 快照模态框 */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">创建快照</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">快照描述</label>
                <textarea
                  value={snapshotDescription}
                  onChange={(e) => setSnapshotDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="请输入快照描述"
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowSnapshotModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleCreateSnapshot}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 回退模态框 */}
      {showRollbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">确认回退</h3>
            <p className="text-gray-700 mb-4">确定要回退到最近的快照吗？当前未保存的内容将会丢失。</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowRollbackModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button 
                onClick={confirmRollback}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
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
