import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SummaryTemplate, SummaryTemplateCreate, SummaryTemplateUpdate } from '@/services/summaryTemplateService';

interface SummaryTemplateFormProps {
  templateId: string;
  summaryTemplate?: SummaryTemplate | null;
  onSubmit: (data: SummaryTemplateCreate | SummaryTemplateUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const SummaryTemplateForm: React.FC<SummaryTemplateFormProps> = ({
  templateId,
  summaryTemplate,
  onSubmit,
  onCancel,
  isLoading
}) => {
  const [formData, setFormData] = useState({
    title: summaryTemplate?.title || '',
    generation_mode: summaryTemplate?.generation_mode || 1,
    content_template: summaryTemplate?.content_template || '',
    default_prompt: summaryTemplate?.default_prompt || '',
    custom_prompt: summaryTemplate?.custom_prompt || '',
    order_index: summaryTemplate?.order_index || 0
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'generation_mode' || name === 'order_index' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = summaryTemplate 
      ? formData as SummaryTemplateUpdate
      : { ...formData, template_id: templateId } as SummaryTemplateCreate;
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
        <Input
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">生成方式</label>
        <select
          name="generation_mode"
          value={formData.generation_mode}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={isLoading}
        >
          <option value={1}>复制</option>
          <option value={2}>AI总结</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">内容模板</label>
        <Textarea
          name="content_template"
          value={formData.content_template}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="请输入内容模板"
          rows={4}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">默认提示词</label>
        <Textarea
          name="default_prompt"
          value={formData.default_prompt}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="请输入默认提示词"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">自定义提示词</label>
        <Textarea
          name="custom_prompt"
          value={formData.custom_prompt}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="请输入自定义提示词"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
        <Input
          name="order_index"
          type="number"
          value={formData.order_index}
          onChange={handleChange}
          disabled={isLoading}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" onClick={onCancel} disabled={isLoading}>
          取消
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
};

export default SummaryTemplateForm;