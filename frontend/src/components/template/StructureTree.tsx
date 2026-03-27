import React from 'react';
import { Button } from '@/components/ui/button';
import { StructureTemplate } from '@/services/structureTemplateService';

interface StructureTreeProps {
  structures: StructureTemplate[];
  onEdit: (structure: StructureTemplate) => void;
  onDelete: (structureId: string) => void;
  onAddChild: (parentId: string | null) => void;
}

const StructureTree: React.FC<StructureTreeProps> = ({ 
  structures, 
  onEdit, 
  onDelete, 
  onAddChild 
}) => {
  const renderStructure = (structure: StructureTemplate, level: number = 0) => {
    return (
      <div key={structure.structure_template_id} className="mb-2">
        <div 
          className="flex items-center p-2 border rounded-md"
          style={{ marginLeft: `${level * 20}px` }}
        >
          <div className="flex-1">
            <div className="font-medium">{structure.title}</div>
            <div className="text-sm text-gray-500">
              层级: {structure.level} | 排序: {structure.order_index}
            </div>
          </div>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onAddChild(structure.structure_template_id)}
            >
              添加子结构
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onEdit(structure)}
            >
              编辑
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(structure.structure_template_id)}
            >
              删除
            </Button>
          </div>
        </div>
        {structure.children && structure.children.length > 0 && (
          <div className="mt-2">
            {structure.children.map(child => renderStructure(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {structures.map(structure => renderStructure(structure))}
    </div>
  );
};

export default StructureTree;
