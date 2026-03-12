import React, { useState, useEffect } from 'react';
import { Check, Plus, Trash2, Edit3, Loader2 } from 'lucide-react';
import { useKeywordStore } from '../store/keywordStore';

interface KeywordEditorProps {
  documentId: string;
}

export const KeywordEditor: React.FC<KeywordEditorProps> = ({ documentId }) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const {
    keywords,
    isLoading,
    error,
    selectedKeywords,
    fetchKeywords,
    createKeyword,
    updateKeyword,
    deleteKeyword,
    generateKeywords,
    toggleKeywordSelection
  } = useKeywordStore();

  // 加载关键词数据
  useEffect(() => {
    if (documentId) {
      fetchKeywords(documentId);
    }
  }, [documentId, fetchKeywords]);

  // 开始编辑关键词
  const startEditing = (keyword: any) => {
    setEditingKeywordId(keyword.keyword_id);
    setEditValue(keyword.keyword);
  };

  // 保存编辑
  const saveEdit = (keyword_id: string) => {
    updateKeyword(keyword_id, editValue);
    setEditingKeywordId(null);
    setEditValue('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingKeywordId(null);
    setEditValue('');
  };

  return (
    <div className="flex-1 flex flex-col bg-white relative">
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
                <button
                  onClick={() => generateKeywords(documentId)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>AI 生成</span>
                </button>
              </div>
              
              {/* 添加新关键词 */}
              <div className="mb-6 flex space-x-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createKeyword(documentId, newKeyword)}
                  placeholder="输入新关键词"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                />
                <button
                  onClick={() => createKeyword(documentId, newKeyword)}
                  disabled={!newKeyword.trim() || isLoading}
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
                          onClick={() => toggleKeywordSelection(keyword.keyword_id)}
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
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                          />
                        ) : (
                          <span className="flex-1 text-gray-900">{keyword.keyword}</span>
                        )}
                        
                        {/* 操作按钮 */}
                        <div className="flex items-center space-x-2">
                          {editingKeywordId === keyword.keyword_id ? (
                            <>
                              <button
                                onClick={() => saveEdit(keyword.keyword_id)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(keyword)}
                                className="text-green-600 hover:text-green-800"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => deleteKeyword(keyword.keyword_id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">暂无关键词</p>
                  <p className="text-gray-400 text-sm mt-2">点击"添加"按钮或"AI 生成"按钮来添加关键词</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
