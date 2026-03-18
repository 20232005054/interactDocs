'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Search, Database, Filter } from 'lucide-react';

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');

  const [formData, setFormData] = useState({
    purpose: '',
    display_name: '',
    content: {},
    is_system: true
  });
  const [searchQuery, setSearchQuery] = useState('');

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

  // 获取模板数据
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        let url = '/api/v1/templates';
        if (selectedPurpose) {
          url = `/api/v1/templates/by-purpose/${selectedPurpose}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.status}`);
        }
        const data = await response.json();
        setTemplates(data.data.items);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [selectedPurpose]);

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理创建模板
  const handleCreateTemplate = async () => {
    if (formData.display_name.trim() && formData.purpose.trim()) {
      try {
        const response = await fetch('/api/v1/templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create template');
        }
        
        const data = await response.json();
        setTemplates(prev => [...prev, data.data]);
        setFormData({ purpose: '', display_name: '', content: {}, is_system: true });
        setIsCreating(false);
      } catch (error) {
        console.error('Error creating template:', error);
        alert('创建模板失败，请稍后重试');
      }
    }
  };

  // 处理删除模板
  const handleDeleteTemplate = async (template_id: string) => {
    if (confirm('确定要删除这个模板吗？')) {
      try {
        const response = await fetch(`/api/v1/templates/${template_id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete template');
        }
        
        setTemplates(prev => prev.filter(template => template.template_id !== template_id));
      } catch (error) {
        console.error('Error deleting template:', error);
        alert('删除模板失败，请稍后重试');
      }
    }
  };

  // 处理搜索
  const filteredTemplates = templates.filter(template =>
    template.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.purpose.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">模板管理</h1>
          <p className="mt-2 text-gray-600">管理系统模板的创建、编辑和删除</p>
        </div>

        {/* 搜索、筛选和创建按钮 */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            {/* 搜索框 */}
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                placeholder="搜索模板"
              />
            </div>
            
            {/* 用途筛选 */}
            <div className="relative w-full sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedPurpose}
                onChange={(e) => setSelectedPurpose(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              >
                <option value="">所有用途</option>
                {purposes.map((purpose) => (
                  <option key={purpose} value={purpose}>{purpose}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* 创建按钮 */}
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-6 py-3 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            创建模板
          </button>
        </div>

        {/* 创建模板表单 */}
        {isCreating && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">创建新模板</h2>
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
              <div>
                <label htmlFor="is_system" className="block text-sm font-medium text-gray-700 mb-1">
                  是否为系统模板
                </label>
                <select
                  id="is_system"
                  name="is_system"
                  value={formData.is_system.toString()}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    is_system: e.target.value === 'true'
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setFormData({ purpose: '', display_name: '', content: {}, is_system: true });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition-colors duration-200"
                >
                  <X className="h-5 w-5 inline mr-1" />
                  取消
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  <Save className="h-5 w-5 inline mr-1" />
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 模板列表 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    模板名称
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用途
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    系统模板
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    更新时间
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTemplates.map((template) => (
                  <tr key={template.template_id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Database className="h-5 w-5 text-green-600 mr-2" />
                        <div className="text-sm font-medium text-gray-900">{template.display_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{template.purpose}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{template.is_system ? '是' : '否'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {template.is_active ? '生效' : '未生效'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(template.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(template.updated_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a
                        href={`/templates/${template.template_id}`}
                        className="text-green-600 hover:text-green-900 mr-3 transition-colors duration-150"
                      >
                        <Edit className="h-5 w-5 inline" />
                      </a>
                      <button
                        onClick={() => handleDeleteTemplate(template.template_id)}
                        className="text-red-600 hover:text-red-900 transition-colors duration-150"
                      >
                        <Trash2 className="h-5 w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTemplates.length === 0 && (
            <div className="px-6 py-12 text-center">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">没有找到模板</p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 inline-flex items-center px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                创建第一个模板
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
