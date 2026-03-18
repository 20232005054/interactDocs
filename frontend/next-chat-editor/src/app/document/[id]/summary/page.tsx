'use client';

import { useState, useEffect } from 'react';
import LeftSidebar from '../../../../components/LeftSidebar';
import { SummaryEditor } from '../../../../components/SummaryEditor';
import RightSidebar from '../../../../components/RightSidebar';
import { useDocumentStore } from '../../../../store/documentStore';

export default function SummaryManager({ params }: { params: Promise<{ id: string }> }) {
  const [documentId, setDocumentId] = useState<string>('');
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256); // 默认宽度256px
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320); // 默认宽度320px

  const {
    document,
    loading,
    error,
    fetchDocument,
    fetchSnapshots
  } = useDocumentStore();

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

  // 获取文档信息
  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
      fetchSnapshots(documentId);
    }
  }, [documentId, fetchDocument, fetchSnapshots]);

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
        <SummaryEditor 
          documentId={documentId}
        />


      </div>
    </div>
  );
}
