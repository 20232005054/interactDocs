# AI 对话上下文重复问题修复

## 问题描述

在段落中点击"添加上下文"按钮后，再点击该段落的编辑区，会在 AI 对话中出现两个相同的段落上下文：
1. **手动添加**（manual）
2. **当前操作**（selection）

## 原因分析

### 上下文类型

系统有两种段落上下文类型：

#### 1. 手动添加（manual）
- **触发方式**：用户点击段落工具栏的"添加上下文"按钮
- **context_id**：`manual:paragraph:{paragraphId}`
- **source**：`"manual"`
- **生命周期**：一直保留，直到用户手动删除
- **用途**：用户明确指定要包含在 AI 对话中的段落

#### 2. 当前操作（selection）
- **触发方式**：用户点击段落编辑区
- **context_id**：`"selection:paragraph"`（固定值，全局唯一）
- **source**：`"selection"`
- **生命周期**：会被新的选中段落替换
- **用途**：表示"当前正在编辑的段落"，方便 AI 理解用户当前的操作上下文

### 问题场景

1. 用户点击段落 A 的"添加上下文"按钮
   - 添加了 `manual:paragraph:A` 上下文
   
2. 用户点击段落 A 的编辑区
   - 又添加了 `selection:paragraph` 上下文（内容也是段落 A）

3. 结果：AI 对话中出现两个相同的段落 A

### 为什么会这样设计？

- **manual**：用户希望 AI 始终关注某些段落（如研究背景、核心结论等）
- **selection**：AI 需要知道用户当前在编辑哪个段落，以便提供针对性的建议

但是，当用户已经手动添加了某个段落，再点击该段落编辑时，就会出现重复。

## 解决方案

### 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| 方案 1 | 点击编辑区时，如果该段落已是 manual 上下文，则不添加 selection | 避免重复 | 用户可能不理解为什么点击没反应 |
| 方案 2 | 点击编辑区时，如果该段落已是 manual 上下文，则移除 manual，只保留 selection | 逻辑清晰 | 用户手动添加的上下文被自动移除 |
| **方案 3（已采用）** | 点击编辑区时，如果该段落已是 manual 上下文，则跳过添加 selection | 尊重用户的手动选择，避免重复 | 需要清晰的 UI 提示 |

### 实现方案 3

#### 修改逻辑
```typescript
// 点击编辑区时同步选中上下文
// 如果该段落已经是手动添加的上下文，则不添加 selection 上下文（避免重复）
const hasManualContext = useChatStore.getState().contextItems.some((item) => (
  item.kind === "paragraph" && 
  item.source === "manual" && 
  item.paragraph_id === paragraph.paragraph_id
))

if (!hasManualContext) {
  upsertSelectionParagraphContext({
    paragraph_id: paragraph.paragraph_id,
    chapter_id: chapterId,
    chapter_title: chapterTitle,
    content: localContent,
    para_type: paragraph.para_type,
  })
}
```

#### 修改文件
- `frontend/src/components/editor/DocumentBody.tsx`

## 修复效果

### 修复前
1. 用户点击"添加上下文"按钮 → 添加 manual 上下文
2. 用户点击编辑区 → 又添加 selection 上下文
3. **结果**：AI 对话中出现两个相同的段落 ❌

### 修复后
1. 用户点击"添加上下文"按钮 → 添加 manual 上下文
2. 用户点击编辑区 → 检测到已有 manual 上下文，跳过添加 selection
3. **结果**：AI 对话中只有一个段落 ✅

## 用户体验

### 场景 1：用户手动添加了段落 A
- 点击段落 A 编辑 → 不会重复添加
- 点击段落 B 编辑 → 添加 selection 上下文（段落 B）
- **AI 对话中**：段落 A（manual）+ 段落 B（selection）

### 场景 2：用户没有手动添加任何段落
- 点击段落 A 编辑 → 添加 selection 上下文（段落 A）
- 点击段落 B 编辑 → 替换 selection 上下文（段落 B）
- **AI 对话中**：只有段落 B（selection）

### 场景 3：用户手动添加了段落 A 和 B
- 点击段落 A 编辑 → 不会重复添加
- 点击段落 B 编辑 → 不会重复添加
- 点击段落 C 编辑 → 添加 selection 上下文（段落 C）
- **AI 对话中**：段落 A（manual）+ 段落 B（manual）+ 段落 C（selection）

## 设计理念

### 手动添加（manual）
- **用户主动**：用户明确指定要包含的段落
- **持久性**：一直保留，直到用户手动删除
- **多个段落**：可以同时添加多个段落
- **用途**：构建 AI 对话的"固定上下文"

### 当前操作（selection）
- **系统自动**：系统根据用户操作自动添加
- **临时性**：会被新的选中段落替换
- **单个段落**：全局只有一个 selection 上下文
- **用途**：让 AI 知道用户"当前在做什么"

### 优先级
- **manual 优先**：如果段落已经是 manual 上下文，则不添加 selection
- **尊重用户选择**：用户手动添加的上下文不会被自动操作覆盖

## 后续优化建议

### UI 提示优化
1. **"添加上下文"按钮状态**：
   - 已添加：显示"已加上下文"（橙色高亮）
   - 未添加：显示"添加上下文"（灰色）

2. **AI 对话中的上下文卡片**：
   - manual：显示"手动添加"标签（橙色）
   - selection：显示"当前操作"标签（蓝色）

3. **删除按钮**：
   - manual：显示删除按钮（用户可以删除）
   - selection：不显示删除按钮（自动管理）

### 功能增强
1. **批量添加**：支持选中多个段落批量添加上下文
2. **上下文预设**：保存常用的上下文组合
3. **智能推荐**：AI 根据对话内容推荐相关段落

## 总结

本次修复解决了 AI 对话中段落上下文重复的问题：

- ✅ **避免重复**：手动添加的段落不会再被自动添加为 selection 上下文
- ✅ **尊重用户**：用户的手动选择优先级更高
- ✅ **逻辑清晰**：manual 和 selection 各司其职，不会冲突

**核心原则**：
- manual = 用户说"我要这个"
- selection = 系统说"你在看这个"
- 当两者冲突时，听用户的！

修复已完成，可以测试验证！🎉
