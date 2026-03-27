import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StructureTemplate, StructureTemplateCreate, StructureTemplateUpdate } from '@/services/structureTemplateService';

interface StructureTemplateFormProps {
  templateId: string;
  structureTemplate?: StructureTemplate | null;
  parentOptions?: { value: string | null; label: string }[];
  onSubmit: (data: StructureTemplateCreate | StructureTemplateUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const StructureTemplateForm: React.FC<StructureTemplateFormProps> = ({
  templateId,
  structureTemplate,
  parentOptions = [],
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<StructureTemplateCreate>({
    template_id: templateId,
    parent_id: null,
    title: '',
    level: 1,
    generation_mode: 0,
    content_template: null,
    sources: null,
    default_prompt: null,
    custom_prompt: null,
    order_index: 0,
  });

  // 初始化表单数据
  useEffect(() => {
    if (structureTemplate) {
      setFormData({
        template_id: structureTemplate.template_id,
        parent_id: structureTemplate.parent_id,
        title: structureTemplate.title,
        level: structureTemplate.level,
        generation_mode: structureTemplate.generation_mode,
        content_template: structureTemplate.content_template,
        sources: structureTemplate.sources,
        default_prompt: structureTemplate.default_prompt,
        custom_prompt: structureTemplate.custom_prompt,
        order_index: structureTemplate.order_index,
      });
    }
  }, [structureTemplate, templateId]);

  // 处理表单输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: target.checked,
      }));
    } else if (name === 'parent_id' && value === 'null') {
      setFormData(prev => ({
        ...prev,
        parent_id: null,
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
          <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
          <Input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="请输入结构标题"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">父结构</label>
          <select
            name="parent_id"
            value={formData.parent_id === null ? 'null' : formData.parent_id}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="null">无（顶级结构）</option>
            {parentOptions.map((option) => (
              <option key={option.value} value={option.value === null ? 'null' : option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">层级</label>
          <Input
            type="number"
            name="level"
            value={formData.level}
            onChange={handleChange}
            placeholder="请输入层级"
            min="1"
            required
          />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">生成方式</label>
          <select
            name="generation_mode"
            value={formData.generation_mode}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="0">复制</option>
            <option value="1">AI总结</option>
          </select>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">内容模板</label>
          <Textarea
            name="content_template"
            value={formData.content_template || ''}
            onChange={handleChange}
            placeholder="请输入内容模板"
            rows={4}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">默认提示词</label>
          <Textarea
            name="default_prompt"
            value={formData.default_prompt || ''}
            onChange={handleChange}
            placeholder="请输入默认提示词"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">自定义提示词</label>
          <Textarea
            name="custom_prompt"
            value={formData.custom_prompt || ''}
            onChange={handleChange}
            placeholder="请输入自定义提示词"
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" onClick={onCancel} disabled={isLoading}>
          取消
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? '提交中...' : structureTemplate ? '更新结构' : '创建结构'}
        </Button>
      </div>
    </form>
  );
};

export default StructureTemplateForm;
