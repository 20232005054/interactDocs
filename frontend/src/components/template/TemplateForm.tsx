import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Template } from '@/services/templateService';

interface TemplateFormProps {
  template?: Template | null;
  onSubmit: (data: {
    purpose: string;
    display_name: string;
    content: { description: string; default_prompt: string };
    is_system?: boolean;
    is_active?: boolean;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TemplateForm: React.FC<TemplateFormProps> = ({
  template,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    purpose: '',
    display_name: '',
    content: {
      description: '',
      default_prompt: '',
    },
    is_system: false,
    is_active: true,
  });

  // 初始化表单数据
  useEffect(() => {
    if (template) {
      setFormData({
        purpose: template.purpose,
        display_name: template.display_name,
        content: {
          description: template.content?.description || '',
          default_prompt: template.content?.default_prompt || '',
        },
        is_system: template.is_system,
        is_active: template.is_active,
      });
    }
  }, [template]);

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as Record<string, any>),
          [child]: value,
        },
      }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: target.checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模板用途</label>
          <Input
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            placeholder="请输入模板用途"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模板名称</label>
          <Input
            name="display_name"
            value={formData.display_name}
            onChange={handleChange}
            placeholder="请输入模板名称"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">模板描述</label>
          <Textarea
            name="content.description"
            value={formData.content.description}
            onChange={handleChange}
            placeholder="请输入模板描述"
            rows={3}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">默认提示词</label>
          <Textarea
            name="content.default_prompt"
            value={formData.content.default_prompt}
            onChange={handleChange}
            placeholder="请输入默认提示词"
            rows={4}
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_system"
            name="is_system"
            checked={formData.is_system}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_system" className="text-sm font-medium text-gray-700">
            是否系统模板
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            是否激活
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" onClick={onCancel} disabled={isLoading}>
          取消
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? '提交中...' : template ? '更新模板' : '创建模板'}
        </Button>
      </div>
    </form>
  );
};

export default TemplateForm;
