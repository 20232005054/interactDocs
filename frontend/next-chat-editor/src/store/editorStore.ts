import { create } from 'zustand';

interface EditorState {
  // UI 布局状态
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  isResizing: 'left' | 'right' | false;
  
  // 选中状态
  selectedChapterId: string | null;
  selectedBlockId: string | null;
  editingBlockId: string | null;
  activeAIBlockId: string | null;
  
  // Actions
  setLeftCollapsed: (collapsed: boolean) => void;
  setRightCollapsed: (collapsed: boolean) => void;
  setResizing: (resizing: 'left' | 'right' | false) => void;
  setWidths: (side: 'left' | 'right', width: number) => void;
  setSelectedChapter: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setActiveAIBlock: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  leftSidebarWidth: 256,
  rightSidebarWidth: 320,
  isResizing: false,
  selectedChapterId: null,
  selectedBlockId: null,
  editingBlockId: null,
  activeAIBlockId: null,
  
  setLeftCollapsed: (collapsed) => set({ leftSidebarCollapsed: collapsed }),
  setRightCollapsed: (collapsed) => set({ rightSidebarCollapsed: collapsed }),
  setResizing: (resizing) => set({ isResizing: resizing }),
  setWidths: (side, width) => set((state) => ({
    leftSidebarWidth: side === 'left' ? width : state.leftSidebarWidth,
    rightSidebarWidth: side === 'right' ? width : state.rightSidebarWidth
  })),
  setSelectedChapter: (id) => set({ selectedChapterId: id }),
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  setEditingBlock: (id) => set({ editingBlockId: id }),
  setActiveAIBlock: (id) => set({ activeAIBlockId: id }),
}));