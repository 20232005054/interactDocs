import { Field, FormData } from '../lib/types/form';
import { handleTextareaInput, handleTextareaFocus } from '../lib/utils/ui';

interface FormFieldProps {
  field: Field;
  formData: FormData;
  onChange: (field: string, value: string) => void;
}

export default function FormField({ field, formData, onChange }: FormFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange(field.field, e.target.value);
  };

  return (
    <div key={field.field} className="mb-6">
      <label 
        htmlFor={field.field} 
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      
      {field.type === 'input' ? (
        <div>
          <textarea
            id={field.field}
            value={formData[field.field] || ''}
            onChange={handleChange}
            onBlur={(e) => e.target.blur()}
            onInput={handleTextareaInput}
            onFocus={handleTextareaFocus}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            placeholder={field.label === '方案标题' ? '请输入方案标题' : '请输入关键词，用空格分隔'}
            style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
            maxLength={field.field === 'title' ? 80 : undefined}
          />
          {field.field === 'title' && (
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm text-gray-500">
                {(formData.title?.length || 0)}/80
              </div>
              {/* 收藏夹导入按钮 */}
              <button
                type="button"
                className="text-sm text-green-600 hover:text-green-800 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                收藏夹导入
              </button>
            </div>
          )}
        </div>
      ) : field.type === 'textarea' ? (
        <textarea
          id={field.field}
          value={formData[field.field] || ''}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
          placeholder={`请输入${field.label}`}
          rows={4}
        />
      ) : field.type === 'select' ? (
        <div>
          <select
            id={field.field}
            value={formData[field.field] || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            style={{ minHeight: '40px', resize: 'none' }}
          >
            <option value="">请选择{field.label}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
          {formData[field.field] === '其他' && (
            <textarea
              id={`${field.field}_other`}
              value={formData[`${field.field}_other`] || ''}
              onChange={(e) => onChange(`${field.field}_other`, e.target.value)}
              onBlur={(e) => e.target.blur()}
              onInput={handleTextareaInput}
              onFocus={handleTextareaFocus}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 mt-2"
              placeholder="请输入其他使用目的"
              style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
