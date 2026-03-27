import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CoreInfoTemplate, CoreInfoTemplateCreate, CoreInfoTemplateUpdate } from '@/services/coreInfoTemplateService';

interface CoreInfoTemplateFormProps {
  templateId: string;
  coreInfoTemplate?: CoreInfoTemplate | null;
  onSubmit: (data: CoreInfoTemplateCreate | CoreInfoTemplateUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CoreInfoTemplateForm: React.FC<CoreInfoTemplateFormProps> = ({
  templateId,
  coreInfoTemplate,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CoreInfoTemplateCreate>({
    template_id: templateId,
    field_name: '',
    field_key: '',
    field_type: 'text',
    default_value: null,
    options: null,
    is_required: true,
    order_index: 0,
  });

  // 初始化表单数据
  useEffect(() => {
    if (coreInfoTemplate) {
      setFormData({
        template_id: coreInfoTemplate.template_id,
        field_name: coreInfoTemplate.field_name,
        field_key: coreInfoTemplate.field_key,
        field_type: coreInfoTemplate.field_type,
        default_value: coreInfoTemplate.default_value,
        options: coreInfoTemplate.options,
        is_required: coreInfoTemplate.is_required,
        order_index: coreInfoTemplate.order_index,
      });
    }
  }, [coreInfoTemplate, templateId]);

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: target.checked,
      }));
    } else if (name === 'options') {
      // 处理选项输入，假设输入格式为逗号分隔的选项
      const options = value
        .split(',')
        .map(option => option.trim())
        .filter(option => option);
      setFormData(prev => ({
        ...prev,
        options: options.length > 0 ? options : null,
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
          <label className="block text-sm font-medium text-gray-700 mb-1">字段名称</label>
          <Input
            name="field_name"
            value={formData.field_name}
            onChange={handleChange}
            placeholder="请输入字段名称"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">字段标识</label>
          <Input
            name="field_key"
            value={formData.field_key}
            onChange={handleChange}
            placeholder="请输入字段标识"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">字段类型</label>
          <select
            name="field_type"
            value={formData.field_type}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          >
            <option value="text">文本</option>
            <option value="number">数字</option>
            <option value="date">日期</option>
            <option value="select">选择</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
          <Input
            type="number"
            name="order_index"
            value={formData.order_index}
            onChange={handleChange}
            placeholder="请输入排序值"
            min="0"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">默认值</label>
          <Input
            name="default_value"
            value={formData.default_value || ''}
            onChange={handleChange}
            placeholder="请输入默认值"
          />
        </div>
        {formData.field_type === 'select' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">选项（逗号分隔）</label>
            <Input
              name="options"
              value={formData.options ? formData.options.join(', ') : ''}
              onChange={handleChange}
              placeholder="请输入选项，用逗号分隔"
            />
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_required"
            name="is_required"
            checked={formData.is_required}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_required" className="text-sm font-medium text-gray-700">
            是否必填
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" onClick={onCancel} disabled={isLoading}>
          取消
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? '提交中...' : coreInfoTemplate ? '更新字段' : '创建字段'}
        </Button>
      </div>
    </form>
  );
};

export default CoreInfoTemplateForm;
