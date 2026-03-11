'use client';

import { useState, useEffect } from 'react';
import { Clipboard, BookOpen, History } from 'lucide-react';

export default function Home() {
  const [metadata, setMetadata] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [summaries, setSummaries] = useState<Array<{title: string, content: string}>>([{title: '', content: ''}]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 模板相关状态
  const [templatePurposes, setTemplatePurposes] = useState<string[]>([]);
  const [templatesByPurpose, setTemplatesByPurpose] = useState<Record<string, any[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // 获取元数据
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/metadata/generate', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setMetadata(data.data);
        
        // 初始化表单数据
        const initialFormData: Record<string, string> = {};
        data.data.fields.forEach((field: any) => {
          initialFormData[field.field] = '';
        });
        setFormData(initialFormData);
        setKeywords([]);
        setKeywordInput('');
        
        // 获取模板用途
        await fetchTemplatePurposes();
      } catch (err) {
        console.error('Error fetching metadata:', err);
        setError(`获取元数据失败，使用默认字段: ${err instanceof Error ? err.message : String(err)}`);
        
        // 使用默认元数据
        const defaultMetadata = {
          generateType: "scheme_gc",
          title: "方案生成",
          fields: [
            {
              field: "title",
              label: "方案标题",
              type: "input",
              required: true
            },
            {
              field: "content",
              label: "参考正文",
              type: "textarea",
              required: false
            },
            {
              field: "purpose",
              label: "使用目的",
              type: "select",
              options: ["申报", "临床", "总结", "其他"],
              required: true
            }
          ]
        };
        setMetadata(defaultMetadata);
        
        const initialFormData: any = {};
        defaultMetadata.fields.forEach((field: any) => {
          initialFormData[field.field] = '';
        });
        setFormData(initialFormData);
        setKeywords([]);
        setKeywordInput('');
        
        // 获取模板用途
        await fetchTemplatePurposes();
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  // 获取模板用途
  const fetchTemplatePurposes = async () => {
    try {
      const response = await fetch('/api/v1/templates/purposes/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplatePurposes(data.data.purposes || []);
      }
    } catch (error) {
      console.error('Error fetching template purposes:', error);
    }
  };

  // 根据用途获取模板
  const fetchTemplatesByPurpose = async (purpose: string) => {
    try {
      const response = await fetch(`/api/v1/templates/by-purpose/${purpose}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplatesByPurpose(prev => ({
          ...prev,
          [purpose]: data.data.items || []
        }));
        // 重置模板选择
        setSelectedTemplate('');
      }
    } catch (error) {
      console.error('Error fetching templates by purpose:', error);
    }
  };

  // 处理表单输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: Record<string, string>) => ({
      ...prev,
      [field]: value
    }));
    
    // 当选择使用目的时，加载对应的模板列表
    if (field === 'purpose' && value) {
      fetchTemplatesByPurpose(value);
    }
  };

  // 添加关键词
  const addKeyword = () => {
    if (keywordInput.trim()) {
      setKeywords((prev) => [...prev, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  // 删除关键词
  const removeKeyword = (index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  // 添加摘要
  const addSummary = () => {
    setSummaries((prev) => [...prev, { title: '', content: '' }]);
  };

  // 更新摘要
  const updateSummary = (index: number, field: 'title' | 'content', value: string) => {
    setSummaries((prev) => {
      const newSummaries = [...prev];
      newSummaries[index] = { ...newSummaries[index], [field]: value };
      return newSummaries;
    });
  };

  // 删除摘要
  const removeSummary = (index: number) => {
    setSummaries((prev) => prev.filter((_, i) => i !== index));
  };

  // 处理生成文档
  const handleGenerateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 只发送required为true的字段
      const requiredFields: any = {};
      metadata?.fields
        .filter((field: any) => field.required && field.field !== 'keywords' && field.field !== 'content')
        .forEach((field: any) => {
          requiredFields[field.field] = formData[field.field];
          // 如果选择了"其他"，添加自定义内容
          if (formData[field.field] === '其他' && formData[`${field.field}_other`]) {
            requiredFields[`${field.field}_other`] = formData[`${field.field}_other`];
          }
        });

      // 添加参考正文（可选）
      if (formData.content) {
        requiredFields.content = formData.content;
      }

      // 添加模板ID（可选）
      if (selectedTemplate) {
        requiredFields.template_id = selectedTemplate;
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requiredFields),
      });

      if (!response.ok) {
        throw new Error('生成文档失败');
      }

      const data = await response.json();
      const documentId = data.data.document_id;

      // 批量创建关键词
      if (keywords.length > 0) {
        const keywordsData = {
          keywords: keywords.map(keyword => ({
            document_id: documentId,
            keyword: keyword
          }))
        };

        await fetch('/api/v1/keywords/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(keywordsData),
        });
      }

      // 批量创建摘要
      const nonEmptySummaries = summaries.filter(summary => summary.title.trim() && summary.content.trim());
      if (nonEmptySummaries.length > 0) {
        const summariesData = {
          summaries: nonEmptySummaries.map(summary => ({
            document_id: documentId,
            title: summary.title,
            content: summary.content
          }))
        };

        await fetch('/api/v1/summaries/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(summariesData),
        });
      }

      // 跳转到新生成的文档编辑页面
      window.location.href = `/document/${documentId}`;
    } catch (err) {
      console.error('Error generating document:', err);
      alert('生成文档失败，请稍后重试');
    }
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

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">研究方案生成</h1>
          <p className="mt-2 text-gray-600">快速创建专业的研究方案文档</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleGenerateDocument} className="bg-white rounded-lg shadow-md p-6 mb-8">
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* 动态生成表单字段 */}
          {metadata?.fields
            .filter((field: any) => field.required && field.field !== 'keywords' && field.field !== 'content')
            .map((field: any) => (
              <div key={field.field} className="mb-6">
                <label 
                  htmlFor={field.field} 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {field.label} <span className="text-red-500">*</span>
                </label>
                
                {field.type === 'input' ? (
                  <div>
                    <textarea
                      id={field.field}
                      value={formData[field.field] || ''}
                      onChange={(e) => handleInputChange(field.field, e.target.value)}
                      onBlur={(e) => e.target.blur()}
                      onInput={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                      placeholder={field.label === '方案标题' ? '请输入方案标题' : '请输入关键词，用空格分隔'}
                      style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                      maxLength={field.field === 'title' ? 80 : undefined}
                    />
                    {field.field === 'title' && (
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-gray-500">
                          {formData.title?.length || 0}/80
                        </div>
                        {/* 收藏夹导入按钮 */}
                        <button
                          type="button"
                          className="text-sm text-green-600 hover:text-green-800 flex items-center"
                        >
                          <Clipboard size={16} className="mr-1" />
                          收藏夹导入
                        </button>
                      </div>
                    )}
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={field.field}
                    value={formData[field.field] || ''}
                    onChange={(e) => handleInputChange(field.field, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                    placeholder={`请输入${field.label}`}
                    rows={4}
                  />
                ) : field.type === 'select' ? (
                  <div>
                    <select
                      id={field.field}
                      value={formData[field.field] || ''}
                      onChange={(e) => handleInputChange(field.field, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                      style={{ minHeight: '40px', resize: 'none' }}
                    >
                      <option value="">请选择{field.label}</option>
                      {field.options.map((option: string, index: number) => (
                        <option key={index} value={option}>{option}</option>
                      ))}
                    </select>
                    {formData[field.field] === '其他' && (
                      <textarea
                        id={`${field.field}_other`}
                        value={formData[`${field.field}_other`] || ''}
                        onChange={(e) => handleInputChange(`${field.field}_other`, e.target.value)}
                        onBlur={(e) => e.target.blur()}
                        onInput={(e) => {
                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 mt-2"
                        placeholder="请输入其他使用目的"
                        style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                      />
                    )}
                    {/* 模板选择 */}
                    {field.field === 'purpose' && formData[field.field] && templatesByPurpose[formData[field.field]] && (
                      <div className="mt-4">
                        <label 
                          htmlFor="template" 
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          选择模板
                        </label>
                        <select
                          id="template"
                          value={selectedTemplate || ''}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                          style={{ minHeight: '40px', resize: 'none' }}
                        >
                          <option value="">请选择模板</option>
                          {templatesByPurpose[formData[field.field]].map((template: any, index: number) => (
                            <option key={index} value={template.template_id}>{template.display_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

          {/* 参考正文输入区域（可选） */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参考正文
            </label>
            <textarea
              id="content"
              value={formData.content || ''}
              onChange={(e) => handleInputChange('content', e.target.value)}
              onBlur={(e) => e.target.blur()}
              onInput={(e) => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
              }}
              onFocus={(e) => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="请输入参考正文"
              style={{ minHeight: '80px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
            />
          </div>

          {/* 关键词输入区域（可选） */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词 
            </label>
            <div>
              {/* 关键词输入区域 */}
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="请输入关键词"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                  确定添加
                </button>
              </div>
              {/* 已添加关键词显示 */}
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <div key={index} className="flex items-center bg-gray-100 px-3 py-1 rounded-full">
                    <span className="text-gray-700 mr-2">{keyword}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="text-gray-500 hover:text-red-500 focus:outline-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 摘要输入区域（可选） */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              摘要
            </label>
            {summaries.map((summary, index) => (
              <div key={index} className="mb-3 flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={summary.title}
                    onChange={(e) => updateSummary(index, 'title', e.target.value)}
                    onBlur={(e) => e.target.blur()}
                    onInput={(e) => {
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                    placeholder="请输入摘要标题"
                    style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                  />
                </div>
                <div className="flex-2">
                  <textarea
                    value={summary.content}
                    onChange={(e) => updateSummary(index, 'content', e.target.value)}
                    onBlur={(e) => e.target.blur()}
                    onInput={(e) => {
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                    placeholder="请输入摘要内容"
                    style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
                  />
                </div>
                <div className="flex items-start pt-2">
                  <button
                    type="button"
                    onClick={() => removeSummary(index)}
                    className="text-gray-500 hover:text-red-500 focus:outline-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSummary}
              className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              添加摘要
            </button>
          </div>

          {/* 底部操作区 */}
          <div className="mt-10 text-center">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              生成文档
            </button>
            
            <div className="mt-4 flex justify-center space-x-6">
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900 flex items-center text-sm"
              >
                <BookOpen size={16} className="mr-1" />
                使用教程
              </button>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900 flex items-center text-sm"
              >
                <History size={16} className="mr-1" />
                历史记录
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
