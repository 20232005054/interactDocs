'use client';

import { useState, useEffect } from 'react';
import LeftSidebar from '../../../../components/LeftSidebar';
import ChapterEditor from '../../../../components/ChapterEditor';
import RightSidebar from '../../../../components/RightSidebar';
import { useChapterStore } from '../../../../store/chapterStore';

export default function ChapterPage({ params }: { params: Promise<{ id: string; chapter_id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { setDocumentId: setStoreDocumentId, setChapterId: setStoreChapterId, fetchChapters } = useChapterStore();

  // 解析params
  useEffect(() => {
    const getParams = async () => {
      try {
        const { id, chapter_id } = await params;
        setDocumentId(id);
        setChapterId(chapter_id);
        setStoreDocumentId(id);
        setStoreChapterId(chapter_id);
      } catch (err) {
        console.error('Error getting params:', err);
        setError('获取参数失败');
        setLoading(false);
      }
    };
    getParams();
  }, [params, setStoreDocumentId, setStoreChapterId]);

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
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
    fetchChapters(documentId);
  }, [documentId, fetchChapters]);

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
          documentTitle={document?.title || '文档'} 
          selectedChapterId={chapterId}
        />
        
        {/* 中间核心编辑区 */}
        <ChapterEditor 
          documentId={documentId} 
          chapterId={chapterId} 
          documentTitle={document?.title || '文档'} 
          documentKeywords={document?.keywords || []}
        />
        
        {/* 右侧AI对话区 */}
        <RightSidebar 
          documentId={documentId} 
          chapterId={chapterId}
        />
      </div>
    </div>
  );
}
