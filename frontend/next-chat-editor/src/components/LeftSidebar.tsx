import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Plus, Edit3, Trash2, Check, X } from 'lucide-react';
import { useDocumentStore } from '../store/documentStore';
import { useChapterStore } from '../store/chapterStore';

interface LeftSidebarProps {
  documentId: string;
  documentTitle?: string;
  selectedChapterId?: string;
  leftSidebarCollapsed?: boolean;
  setLeftSidebarCollapsed?: (collapsed: boolean) => void;
  leftSidebarWidth?: number;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  documentId,
  documentTitle,
  selectedChapterId,
  leftSidebarCollapsed = false,
  setLeftSidebarCollapsed = () => {},
  leftSidebarWidth = 256
}) => {
  const [recentDocsExpanded, setRecentDocsExpanded] = useState(true);
  const [docDetailsExpanded, setDocDetailsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'snapshots' | 'related'>('snapshots');
  const [editingDocDetail, setEditingDocDetail] = useState<string | null>(null);
  const [docDetailValue, setDocDetailValue] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [purposeOptions, setPurposeOptions] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [showEditChapterModal, setShowEditChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [editChapterId, setEditChapterId] = useState<string | null>(null);
  const [parentChapterId, setParentChapterId] = useState<string | null>(null);

  const {
    document,
    recentDocuments,
    snapshots,
    fetchRecentDocuments,
    updateDocument,
    setError
  } = useDocumentStore();

  const {
    chapters,
    expandedChapters,
    toggleChapter,
    addChapter,
    updateChapterTitle,
    deleteChapter,
    fetchChapters
  } = useChapterStore();

  // 获取最近文档
  React.useEffect(() => {
    fetchRecentDocuments();
  }, [fetchRecentDocuments]);

  // 获取章节列表
  React.useEffect(() => {
    if (documentId) {
      fetchChapters(documentId);
    }
  }, [documentId, fetchChapters]);

  // 获取使用目的选项
  React.useEffect(() => {
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
  React.useEffect(() => {
    const fetchTemplateData = async () => {
      try {
        // 获取所有模板
        const templatesResponse = await fetch('/api/v1/templates');
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          setTemplates(templatesData.data.items || []);
        }
      } catch (error) {
        console.error('获取模板数据失败:', error);
      }
    };
    fetchTemplateData();
  }, []);

  // 获取模板详情
  React.useEffect(() => {
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

    if (document?.template_id) {
      fetchTemplateById(document.template_id);
    }
  }, [document?.template_id]);

  // 更新文档信息
  const updateDocumentInfo = async (field: string, value: string | string[]) => {
    try {
      await updateDocument(documentId, { [field]: value } as any);
      setEditingDocDetail(null);
      setDocDetailValue('');
    } catch (err) {
      setError('更新文档信息失败');
      console.error('Error updating document info:', err);
    }
  };

  // 打开添加章节弹窗
  const openAddChapterModal = (parentId: string | null = null) => {
    setParentChapterId(parentId);
    setNewChapterTitle('');
    setShowAddChapterModal(true);
  };

  // 添加章节
  const handleAddChapter = async () => {
    if (!newChapterTitle.trim() || !documentId) return;

    try {
      await addChapter(documentId, newChapterTitle, parentChapterId);
      setShowAddChapterModal(false);
    } catch (err) {
      console.error('Error adding chapter:', err);
      alert('添加章节失败');
    }
  };

  // 打开编辑章节弹窗
  const openEditChapterModal = (chapterId: string, currentTitle: string) => {
    setEditChapterId(chapterId);
    setEditChapterTitle(currentTitle);
    setShowEditChapterModal(true);
  };

  // 更新章节标题
  const handleUpdateChapterTitle = async () => {
    if (!editChapterId || !editChapterTitle.trim()) return;

    try {
      await updateChapterTitle(editChapterId, editChapterTitle);
      setShowEditChapterModal(false);
    } catch (err) {
      console.error('Error updating chapter title:', err);
      alert('更新章节标题失败');
    }
  };

  // 删除章节
  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm('确定要删除这个章节吗？')) return;

    try {
      await deleteChapter(chapterId);
    } catch (err) {
      console.error('Error deleting chapter:', err);
      alert('删除章节失败');
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
            <div className={`flex items-center p-2 rounded-md hover:bg-green-50 ${selectedChapterId === chapter.chapter_id ? 'bg-green-100 text-green-800' : 'text-gray-800'}`}>
              {!leftSidebarCollapsed && hasChildren && (
                <button 
                  className={`mr-2 ${selectedChapterId === chapter.chapter_id ? 'text-green-800' : 'text-green-600'}`} 
                  onClick={(e) => {
                    e.preventDefault();
                    toggleChapter(chapter.chapter_id);
                  }}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              {!leftSidebarCollapsed && !hasChildren && <div className="w-4 mr-2" />}
              <a 
                href={`/document/${documentId}/${chapter.chapter_id}`}
                className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}
                title={chapter.title}
              >
                {chapter.title}
              </a>
              {!leftSidebarCollapsed && (
                <div className="flex items-center space-x-2">
                  <button 
                    className={`${selectedChapterId === chapter.chapter_id ? 'text-green-800' : 'text-green-600'} hover:text-green-800`}
                    onClick={() => openEditChapterModal(chapter.chapter_id, chapter.title)}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    className="text-red-600 hover:text-red-800"
                    onClick={() => handleDeleteChapter(chapter.chapter_id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              {leftSidebarCollapsed && (
                <div className="flex items-center justify-center">
                  <Edit3 size={16} />
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

  return (
    <div 
      className={`bg-white border-r border-gray-200 p-4 overflow-y-auto transition-all duration-300 ease-in-out ${leftSidebarCollapsed ? 'w-16' : ''}`} 
      style={{ width: leftSidebarCollapsed ? '64px' : `${leftSidebarWidth}px`, transition: 'none' }}
    >
      {/* 文档标题 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-lg font-semibold text-gray-900 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>{documentTitle || document?.title || '文档'}</h2>
          <div className="flex items-center space-x-2">
            <button 
              className="text-green-600 hover:text-green-800"
              onClick={() => openAddChapterModal(null)}
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
                    onClick={() => window.location.href = `/document/${doc.document_id}`}
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
        <a
          href={`/document/${documentId}/keyword`}
          className={`w-full flex items-center p-2 rounded-md hover:bg-green-50 text-gray-800`}
        >
          <span className={`flex-1 ${leftSidebarCollapsed ? 'hidden' : 'block'}`}>关键词</span>
        </a>
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
                  snapshots.map(snapshot => (
                    <div 
                      key={snapshot.version_id} 
                      className={`p-2 border rounded-md cursor-pointer hover:bg-green-50`}
                      onClick={() => {
                        // 应用快照的逻辑将在主页面中处理
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

      {/* 添加章节模态框 */}
      {showAddChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">添加章节</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">章节标题</label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="请输入章节标题"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowAddChapterModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddChapter}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑章节模态框 */}
      {showEditChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑章节</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">章节标题</label>
                <input
                  type="text"
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="请输入章节标题"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowEditChapterModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleUpdateChapterTitle}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftSidebar;
