interface KeywordInputProps {
  keywords: string[];
  keywordInput: string;
  onKeywordInputChange: (input: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (index: number) => void;
}

export default function KeywordInput({ keywords, keywordInput, onKeywordInputChange, onAddKeyword, onRemoveKeyword }: KeywordInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAddKeyword();
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        关键词 
      </label>
      <div>
        {/* 关键词输入区域 */}
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => onKeywordInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            placeholder="请输入关键词"
          />
          <button
            type="button"
            onClick={onAddKeyword}
            className="px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            确定添加
          </button>
        </div>
        {/* 已添加关键词显示 */}
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <div key={index} className="flex items-center bg-gray-100 px-3 py-1 rounded-full">
              <span className="text-gray-700 mr-2">{keyword}</span>
              <button
                type="button"
                onClick={() => onRemoveKeyword(index)}
                className="text-gray-500 hover:text-red-500 focus:outline-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
