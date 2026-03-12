import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Edit3, RefreshCw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSummaryStore } from '../store/summaryStore';

interface SummaryEditorProps {
  documentId: string;
}

export const SummaryEditor: React.FC<SummaryEditorProps> = ({ documentId }) => {
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummaryTitle, setEditingSummaryTitle] = useState('');
  const [editingSummaryContent, setEditingSummaryContent] = useState('');
  const [hoveredSummaryId, setHoveredSummaryId] = useState<string | null>(null);

  const {
    summaries,
    summaryKeywordLinks,
    isLoading,
    generatingSummary,
    error,
    fetchSummaries,
    fetchSummaryKeywordLinks,
    createSummary,
    updateSummary,
    deleteSummary,
    addNextSummary,
    generateSummary
  } = useSummaryStore();

  // 加载摘要数据
  useEffect(() => {
    if (documentId) {
      fetchSummaries(documentId);
      fetchSummaryKeywordLinks(documentId);
    }
  }, [documentId, fetchSummaries, fetchSummaryKeywordLinks]);

  // 开始编辑摘要
  const startEditSummary = (summary: any) => {
    setEditingSummaryId(summary.summary_id);
    setEditingSummaryTitle(summary.title);
    setEditingSummaryContent(summary.content);
  };

  // 保存摘要
  const saveSummary = async (summaryId: string) => {
    await updateSummary(summaryId, editingSummaryTitle, editingSummaryContent);
    setEditingSummaryId(null);
  };

  // 处理点击外部保存编辑
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
  }, [editingSummaryId, editingSummaryTitle, editingSummaryContent]);

  return (
    <div className="flex-1 flex flex-col bg-white relative">
      <div className="flex-1 flex flex-col">
        {/* 摘要头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">摘要管理</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => createSummary(documentId)}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center space-x-2"
              >
                <Plus size={16} />
                <span>添加摘要</span>
              </button>
              <button
                onClick={() => generateSummary(documentId)}
                disabled={generatingSummary}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {generatingSummary ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span>一键生成</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* 摘要编辑区 */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 128px)' }}>
          <div className="max-w-4xl mx-auto p-6">
            {summaries.length > 0 ? (
              <div className="space-y-6">
                {summaries.map((summary, index) => (
                  <div 
                    key={summary.summary_id}
                    className="border border-gray-200 rounded-md p-4 hover:shadow-sm"
                    onMouseEnter={() => setHoveredSummaryId(summary.summary_id)}
                    onMouseLeave={() => setHoveredSummaryId(null)}
                  >
                    {/* 摘要标题 */}
                    {editingSummaryId === summary.summary_id ? (
                      <input
                        type="text"
                        value={editingSummaryTitle}
                        onChange={(e) => setEditingSummaryTitle(e.target.value)}
                        onBlur={() => saveSummary(summary.summary_id)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveSummary(summary.summary_id);
                        }}
                        autoFocus
                        className="w-full text-xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="输入摘要标题"
                      />
                    ) : (
                      <div 
                        className="text-xl font-bold text-gray-900 mb-4 cursor-pointer"
                        onClick={() => startEditSummary(summary)}
                      >
                        {summary.title || '点击输入摘要标题'}
                      </div>
                    )}

                    {/* 摘要内容 */}
                    {editingSummaryId === summary.summary_id ? (
                      <textarea
                        value={editingSummaryContent}
                        onChange={(e) => setEditingSummaryContent(e.target.value)}
                        onBlur={() => saveSummary(summary.summary_id)}
                        className="w-full min-h-[150px] text-gray-800 border border-gray-200 rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="输入摘要内容"
                      />
                    ) : (
                      <div 
                        className="text-gray-800 mb-4 cursor-pointer"
                        onClick={() => startEditSummary(summary)}
                      >
                        {summary.content ? (
                          <ReactMarkdown>{summary.content}</ReactMarkdown>
                        ) : (
                          <p className="text-gray-400">点击输入摘要内容</p>
                        )}
                      </div>
                    )}

                    {/* 摘要操作按钮 */}
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => addNextSummary(documentId, summary.summary_id)}
                          className="text-green-600 hover:text-green-800 flex items-center space-x-1"
                        >
                          <Plus size={14} />
                          <span>在下方添加</span>
                        </button>
                        <button
                          onClick={() => deleteSummary(summary.summary_id)}
                          className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                        >
                          <Trash2 size={14} />
                          <span>删除</span>
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        摘要 {index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无摘要</p>
                <p className="text-gray-400 text-sm mt-2">点击"添加摘要"按钮或"一键生成"按钮来添加摘要</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
