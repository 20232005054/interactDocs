import { handleTextareaInput, handleTextareaFocus } from '../lib/utils/ui';

interface Summary {
  title: string;
  content: string;
}

interface SummaryInputProps {
  summaries: Summary[];
  onAddSummary: () => void;
  onUpdateSummary: (index: number, field: 'title' | 'content', value: string) => void;
  onRemoveSummary: (index: number) => void;
}

export default function SummaryInput({ summaries, onAddSummary, onUpdateSummary, onRemoveSummary }: SummaryInputProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        摘要
      </label>
      {summaries.map((summary, index) => (
        <div key={index} className="mb-3 flex space-x-4">
          <div className="flex-1">
            <textarea
              value={summary.title}
              onChange={(e) => onUpdateSummary(index, 'title', e.target.value)}
              onBlur={(e) => e.target.blur()}
              onInput={handleTextareaInput}
              onFocus={handleTextareaFocus}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="请输入摘要标题"
              style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
            />
          </div>
          <div className="flex-2">
            <textarea
              value={summary.content}
              onChange={(e) => onUpdateSummary(index, 'content', e.target.value)}
              onBlur={(e) => e.target.blur()}
              onInput={handleTextareaInput}
              onFocus={handleTextareaFocus}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="请输入摘要内容"
              style={{ minHeight: '40px', maxHeight: 'calc(100vh - 250px)', resize: 'none', overflow: 'auto' }}
            />
          </div>
          <div className="flex items-start pt-2">
            <button
              type="button"
              onClick={() => onRemoveSummary(index)}
              className="text-gray-500 hover:text-red-500 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAddSummary}
        className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
      >
        添加摘要
      </button>
    </div>
  );
}
