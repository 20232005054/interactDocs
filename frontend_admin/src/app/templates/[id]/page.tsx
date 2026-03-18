'use client';

import { useState, useEffect } from 'react';
import { Save, X, ArrowLeft, Database, AlertCircle } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface Template {
  template_id: string;
  group_id: string;
  purpose: string;
  display_name: string;
  content: any;
  version: number;
  is_system: boolean;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TemplateEditPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    purpose: string;
    display_name: string;
    is_system: boolean;
    is_active: boolean;
    content: {
      prompt: {
        task_type: string;
        system_prompt: string;
        user_prompt_template: string;
      };
      schema: {
        schema_json: Array<{
          type: string;
          title: string;
        }>;
      };
      summary: {
        title_templates: string[];
      };
    };
  }>({
    purpose: '',
    display_name: '',
    is_system: true,
    is_active: true,
    content: {
      prompt: {
        task_type: '',
        system_prompt: '',
        user_prompt_template: ''
      },
      schema: {
        schema_json: []
      },
      summary: {
        title_templates: []
      }
    }
  });

  // 获取所有用途
  useEffect(() => {
    const fetchPurposes = async () => {
      try {
        const response = await fetch('/api/v1/templates/purposes/list');
        if (response.ok) {
          const data = await response.json();
          setPurposes(data.data.purposes);
        }
      } catch (error) {
        console.error('Error fetching purposes:', error);
      }
    };

    fetchPurposes();
  }, []);

  // 获取模板详情
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/v1/templates/${templateId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch template');
        }
        const data = await response.json();
        setTemplate(data.data);
        setFormData({
          purpose: data.data.purpose,
          display_name: data.data.display_name,
          is_system: data.data.is_system,
          is_active: data.data.is_active,
          content: data.data.content || {
            prompt: {
              task_type: '',
              system_prompt: '',
              user_prompt_template: ''
            },
            schema: {
              schema_json: []
            },
            summary: {
              title_templates: []
            }
          }
        });
      } catch (error) {
        console.error('Error fetching template:', error);
        setTemplate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId]);

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理布尔值输入变化
  const handleBooleanChange = (name: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理prompt输入变化
  const handlePromptChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        prompt: {
          ...prev.content.prompt,
          [field]: value
        }
      }
    }));
  };

  // 处理schema项变化
  const handleSchemaChange = (index: number, field: 'type' | 'title', value: string) => {
    const newSchemaJson = [...formData.content.schema.schema_json];
    newSchemaJson[index] = {
      ...newSchemaJson[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        schema: {
          ...prev.content.schema,
          schema_json: newSchemaJson
        }
      }
    }));
  };

  // 添加schema项
  const addSchemaItem = () => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        schema: {
          ...prev.content.schema,
          schema_json: [...prev.content.schema.schema_json, { type: 'heading-1', title: '新章节' }]
        }
      }
    }));
  };

  // 删除schema项
  const removeSchemaItem = (index: number) => {
    const newSchemaJson = formData.content.schema.schema_json.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        schema: {
          ...prev.content.schema,
          schema_json: newSchemaJson
        }
      }
    }));
  };

  // 处理summary模板变化
  const handleSummaryTemplateChange = (index: number, value: string) => {
    const newTitleTemplates = [...formData.content.summary.title_templates];
    newTitleTemplates[index] = value;
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        summary: {
          ...prev.content.summary,
          title_templates: newTitleTemplates
        }
      }
    }));
  };

  // 添加summary模板
  const addSummaryTemplate = () => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        summary: {
          ...prev.content.summary,
          title_templates: [...prev.content.summary.title_templates, '新模板']
        }
      }
    }));
  };

  // 删除summary模板
  const removeSummaryTemplate = (index: number) => {
    const newTitleTemplates = formData.content.summary.title_templates.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        summary: {
          ...prev.content.summary,
          title_templates: newTitleTemplates
        }
      }
    }));
  };

  // 处理保存
  const handleSave = async () => {
    if (!formData.display_name.trim() || !formData.purpose.trim()) {
      alert('模板名称和用途不能为空');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/v1/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: formData.purpose,
          display_name: formData.display_name,
          is_system: formData.is_system,
          is_active: formData.is_active,
          content: formData.content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      alert('模板更新成功');
      router.push('/templates');
    } catch (error) {
      console.error('Error updating template:', error);
      alert('更新模板失败，请稍后重试');
    } finally {
      setSaving(false);
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

  if (!template) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">模板不存在</h2>
          <p className="text-gray-600 mb-6">无法找到指定的模板，请检查模板ID是否正确</p>
          <button
            onClick={() => router.push('/templates')}
            className="inline-flex items-center px-6 py-3 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            返回模板列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 标题和返回按钮 */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.push('/templates')}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 transition-colors duration-200 mr-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            返回模板列表
          </button>
          <h1 className="text-3xl font-bold text-gray-900">编辑模板</h1>
        </div>

        {/* 编辑表单 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {/* 基本信息 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">基本信息</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                  模板用途 <span className="text-red-500">*</span>
                </label>
                <select
                  id="purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                >
                  <option value="">请选择用途</option>
                  {purposes.map((purpose) => (
                    <option key={purpose} value={purpose}>{purpose}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
                  模板名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="请输入模板名称"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    是否为系统模板
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_system}
                      onChange={(e) => handleBooleanChange('is_system', e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">是</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    是否生效
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleBooleanChange('is_active', e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">是</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt设置 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Prompt设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务类型
                </label>
                <input
                  type="text"
                  value={formData.content.prompt.task_type}
                  onChange={(e) => handlePromptChange('task_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="如：generate_paragraph"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  系统提示
                </label>
                <textarea
                  value={formData.content.prompt.system_prompt}
                  onChange={(e) => handlePromptChange('system_prompt', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="如：你是一名专业的医疗报告撰写专家"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用户提示模板
                </label>
                <textarea
                  value={formData.content.prompt.user_prompt_template}
                  onChange={(e) => handlePromptChange('user_prompt_template', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="如：请根据以下内容生成医疗报告：{{content}}"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* 文档结构 */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">文档结构</h2>
              <button
                onClick={addSchemaItem}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
              >
                添加章节
              </button>
            </div>
            <div className="space-y-4">
              {formData.content.schema.schema_json.map((item, index) => (
                <div key={index} className="flex space-x-4 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      章节类型
                    </label>
                    <input
                      type="text"
                      value={item.type}
                      onChange={(e) => handleSchemaChange(index, 'type', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                      placeholder="如：heading-1"
                    />
                  </div>
                  <div className="flex-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      章节标题
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleSchemaChange(index, 'title', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                      placeholder="如：摘要"
                    />
                  </div>
                  <div className="flex items-start pt-6">
                    <button
                      onClick={() => removeSchemaItem(index)}
                      className="text-red-600 hover:text-red-900 transition-colors duration-150"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 摘要模板 */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">摘要模板</h2>
              <button
                onClick={addSummaryTemplate}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
              >
                添加模板
              </button>
            </div>
            <div className="space-y-3">
              {formData.content.summary.title_templates.map((template, index) => (
                <div key={index} className="flex space-x-3 items-center">
                  <input
                    type="text"
                    value={template}
                    onChange={(e) => handleSummaryTemplateChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                    placeholder="如：研究背景"
                  />
                  <button
                    onClick={() => removeSummaryTemplate(index)}
                    className="text-red-600 hover:text-red-900 transition-colors duration-150"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => router.push('/templates')}
              className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition-colors duration-200"
            >
              <X className="h-5 w-5 inline mr-1" />
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5 inline mr-1" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
