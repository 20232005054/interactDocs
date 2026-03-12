'use client';

import { useEffect } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DocumentTable from '@/components/DocumentTable';

export default function DocumentsPage() {
  const { documents, isLoading, error, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments(1, 100);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <ErrorMessage message={error} />
          <button 
            onClick={() => fetchDocuments(1, 100)}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">全部文档</h1>
          <button 
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            onClick={() => window.location.href = '/'}
          >
            创建新文档
          </button>
        </div>

        <DocumentTable documents={documents} />
      </div>
    </div>
  );
}
