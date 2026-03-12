import { Template } from '../lib/types/template';

interface TemplateSelectorProps {
  purpose: string;
  templates: Template[];
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
}

export default function TemplateSelector({ purpose, templates, selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  if (!purpose || templates.length === 0) {
    return null;
  }

  return (
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
        onChange={(e) => onSelectTemplate(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
        style={{ minHeight: '40px', resize: 'none' }}
      >
        <option value="">请选择模板</option>
        {templates.map((template, index) => (
          <option key={index} value={template.template_id}>{template.display_name}</option>
        ))}
      </select>
    </div>
  );
}
