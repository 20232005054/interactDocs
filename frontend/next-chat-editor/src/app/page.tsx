'use client';

import { useEffect } from 'react';
import { BookOpen, History } from 'lucide-react';
import { useFormStore } from '@/store/formStore';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import FormField from '@/components/FormField';
import TemplateSelector from '@/components/TemplateSelector';
import KeywordInput from '@/components/KeywordInput';
import SummaryInput from '@/components/SummaryInput';

export default function Home() {
  const {
    metadata,
    formData,
    keywords,
    keywordInput,
    summaries,
    templatesByPurpose,
    selectedTemplate,
    loading,
    error,
    setFormData,
    setKeywordInput,
    addKeyword,
    removeKeyword,
    addSummary,
    updateSummary,
    removeSummary,
    setSelectedTemplate,
    fetchMetadata,
    fetchTemplatesByPurpose,
    generateDocument
  } = useFormStore();

  // 组件挂载时获取元数据
  useEffect(() => {
    fetchMetadata();
  }, []);

  // 处理表单输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // 当选择使用目的时，加载对应的模板列表
    if (field === 'purpose' && value) {
      fetchTemplatesByPurpose(value);
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateDocument();
  };

  if (loading) {
    return <LoadingSpinner />;
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
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-8">
          {/* 错误提示 */}
          {error && <ErrorMessage message={error} />}

          {/* 动态生成表单字段 */}
          {metadata?.fields
            .filter((field) => field.required && field.field !== 'keywords' && field.field !== 'content')
            .map((field) => (
              <FormField
                key={field.field}
                field={field}
                formData={formData}
                onChange={handleInputChange}
              />
            ))}

          {/* 模板选择 */}
          {formData.purpose && templatesByPurpose[formData.purpose] && (
            <TemplateSelector
              purpose={formData.purpose}
              templates={templatesByPurpose[formData.purpose]}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
            />
          )}

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

          {/* 关键词输入区域 */}
          <KeywordInput
            keywords={keywords}
            keywordInput={keywordInput}
            onKeywordInputChange={setKeywordInput}
            onAddKeyword={addKeyword}
            onRemoveKeyword={removeKeyword}
          />

          {/* 摘要输入区域 */}
          <SummaryInput
            summaries={summaries}
            onAddSummary={addSummary}
            onUpdateSummary={updateSummary}
            onRemoveSummary={removeSummary}
          />

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
