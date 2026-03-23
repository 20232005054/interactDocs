# 📝 InteractiveDocs 前端项目架构与设计规范 (Spec)

## 1. 视觉与主题规范 (Design Tokens)

基于"专业、清晰、现代"的定位，以浅白为底色，主色调为清新绿色。我们需要首先在 Tailwind 中约束这些颜色，确保全局高度统一。

### 1.1 颜色系统 (基于 `globals.css` 和 Tailwind v4 变量)

项目使用 Tailwind CSS v4，颜色系统基于 `oklch` 色彩空间定义。

- **底色 (Background)**: `oklch(1 0 0)` 纯白 (`--background`)
- **主色调 (Primary)**: 清新绿 `oklch(0.696 0.17 158.8)` (`--primary`)。用于主要按钮、高亮状态、AI 气泡背景。
- **文本颜色 (Foreground)**: 主文本 `oklch(0.145 0 0)` (`--foreground`)，确保极高对比度。
- **辅助色 (Secondary/Muted)**:
  - 浅灰 (用于边框、分割线、禁用态): `oklch(0.922 0 0)` (`--border`, `--muted`)
  - 深灰 (用于次要文本、说明提示): `oklch(0.556 0 0)` (`--muted-foreground`)
- **AI 助手专属色**:
  - 用户消息气泡: 浅绿色 (Primary 的 10% 透明度)
  - AI 消息气泡: 浅灰色 (Muted)

### 1.2 样式约定

- **圆角 (Radius)**: 统一使用中等圆角 `0.625rem` (`--radius`)，体现现代感而不显幼稚。
- **阴影 (Shadow)**: 核心操作区（如文档卡片、浮窗）使用柔和的扩散阴影 `shadow-sm` 或 `shadow-md`，避免过度拟物化。

------

## 2. 路由与页面架构 (Routing Structure)

### 路由编排 (App Router 设计)

遵循 Next.js 16+ App Router 规范，利用嵌套路由（Nested Routes）和布局（Layouts）实现页面区块复用。

| **路由路径 (URL)**             | **物理路径 (app/)**                               | **页面功能描述**                                             | **渲染策略**     |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| `/documents`                   | `app/(overview)/documents/page.tsx`               | **文档历史页面**：展示文档卡片列表，支持分页与检索。         | SSR / 数据预取   |
| `/document`                    | `app/(overview)/document/page.tsx`                | **创建文档页面**：表单（标题、模板、目的），提交后跳转编辑页。 | CSR              |
| 基础布局                       | `app/document/[document_id]/layout.tsx`           | **文档编辑框架**：承载左侧(导航)和右侧(AI助手)，复用外壳。   | Server Component |
| `/document/[id]/`              | `app/document/[id]/page.tsx`                      | **文档总览/默认页**：文档全局配置（Global Variables等）。    | SSR              |
| `/document/[id]/keyword`       | `app/document/[id]/keyword/page.tsx`              | **关键词编辑页**：中间区域渲染关键词列表与提取逻辑。         | CSR              |
| `/document/[id]/summary`       | `app/document/[id]/summary/page.tsx`              | **摘要编辑页**：中间区域渲染摘要块，支持 AI 一键生成。       | CSR              |
| `/document/[id]/chapter/[cid]` | `app/document/[id]/chapter/[chapter_id]/page.tsx` | **章节编辑页**：中间区域加载 Monaco Editor 渲染段落内容。    | CSR              |

```
src/app/
├── (overview)/                   # 布局组：不需要三栏布局的页面
│   ├── documents/                # [页面] 文档历史列表 (/documents)
│   │   └── page.tsx
│   └── document/                 # [页面] 创建文档向导 (/document)
│       └── page.tsx
├── document/
│   └── [document_id]/            # [页面] 文档编辑主模块（采用三栏布局）
│       ├── layout.tsx            # 【核心】三栏布局容器 (LeftNav, MiddleContent, RightAI)
│       ├── page.tsx              # 文档总览/默认页
│       ├── keyword/              # 关键词编辑子页面
│       │   └── page.tsx
│       ├── summary/              # 摘要编辑子页面
│       │   └── page.tsx
│       └── chapter/
│           └── [chapter_id]/     # 章节编辑子页面
│               └── page.tsx
├── layout.tsx                    # 根布局
├── page.tsx                      # 首页（重定向到 /documents）
└── globals.css                   # 全局样式
```

------

## 3. 核心布局规范：三栏编辑布局 (Three-Column Layout)

`/document/[document_id]/layout.tsx` 是整个系统最复杂的布局，必须采用**服务端组件 (RSC) 作为数据获取容器**，将具体的交互下发给客户端组件。

### 3.1 布局划区

- **Left Panel (文档信息区 - 250px)**:
  - 展示文档标题、元数据。
  - 包含导航菜单：基本信息、关键词管理、摘要管理、章节目录（支持拖拽排序）。
- **Middle Panel (核心编辑区 - Flex-1)**:
  - 动态渲染 `children` (即 Keyword, Summary, Chapter 页面)。
  - 使用 Monaco Editor 作为核心文本编辑载体。
- **Right Panel (AI 助手区 - 350px)**:
  - 悬浮或固定的 ChatUI 面板。
  - 监听中间区域的选中状态（段落、关键词），作为 Context 发送给 AI。

------

## 4. 组件设计模式 (Atomic & Container/Presentational)

严格遵循容器与展示组件分离，避免 UI 组件耦合业务逻辑。

### 4.1 目录结构划分

```
src/
├── components/
│   ├── ui/               # 原子组件 (由 shadcn CLI 自动生成，如 Button, Input, ScrollArea)
│   ├── document/         # 领域组件 (分子/组织组件，纯 UI)
│   │   ├── ChapterTree.tsx         # 章节树展示
│   │   ├── MonacoEditorWrapper.tsx # 编辑器 UI 封装
│   │   └── SummaryCard.tsx         # 单个摘要卡片
│   └── chat/             # AI 对话组件组
│       ├── ChatBubble.tsx          # 聊天气泡 (UI)
│       └── AIAssistantPanel.tsx    # 聊天面板主体 (UI)
├── containers/           # 容器组件 (处理数据和状态)
│   ├── EditorContainer.tsx         # 获取章节内容，将数据传给 Monaco
│   └── ChatContainer.tsx           # 调用后端 /api/v1/ai/chat，管理消息流
└── lib/
    └── utils.ts                      # 工具函数
```

### 4.2 基础 UI 组件层 (`src/components/ui/`)

基于 shadcn/ui，直接复用并调整为"清新绿"主题。

- `Button`: 定义 `variant="primary"` (绿底白字), `variant="outline"` (灰边黑字)。
- `Input` / `Textarea`: 统一聚焦状态为绿边 `focus-visible:ring-primary`。
- `ScrollArea`: 用于左右两栏的自定义滚动条。
- `Resizable`: (推荐引入 shadcn 的 Resizable 组件) 用于实现三栏宽度的自由拖拽调整。

### 4.3 业务复用组件层 (`src/components/document/`)

在多个页面中重复使用的含有一定逻辑的区块。

- **`DocumentCard`**: 用于 `/documents` 页面，展示文档标题、更新时间、摘要预览，附带"进入编辑"和"删除"按钮。
- **`MonacoEditorWrapper`**:
  - **约束**: 必须使用 `"use client"` 和 `next/dynamic` 包装。
  - **功能**: 接收 `value`, `onChange`, `language` (默认 markdown 或 text)。自带骨架屏 (Skeleton) 加载状态。
- **`AIChatPanel`**:
  - 封装 `@chatui/core`，集成 SSE 流式请求逻辑。
  - 暴露 `onApplySuggestion` 接口，允许 AI 生成的内容一键应用到中间编辑区。
- **`ContentHeader`**: 编辑区顶部组件，复用于关键词、摘要、章节页面，包含"标题"、"保存按钮"、"AI 帮填按钮"。

### 4.4 状态管理规范 (State Management)

项目中包含多个需要跨层级共享的状态（例如：AI 聊天面板需要知道当前 Monaco 编辑器里选中了哪段文字）。使用已安装的 `zustand`。

- **`useEditorStore` (`src/store/editorStore.ts`)**:
  - `currentDocumentId`: 当前文档 ID。
  - `selectedText`: 用户在 Monaco 中选中的文本（用于传给 AI）。
  - `activeContext`: 当前正在编辑的是章节、摘要还是关键词（告诉 AI 当前语境）。
- **`useChatStore` (`src/store/chatStore.ts`)**:
  - `messages`: 聊天记录列表。
  - `isGenerating`: AI 是否正在流式输出。

------

## 5. 页面详细设计规范

### 5.1 创建文档页面 (`/document`)

- **模式**: 表单模式 (Form Pattern)。
- **UI**: 居中对齐的卡片，包含表单：文档标题、用途目标 (Purpose)、模板选择 (Template Dropdown)。
- **交互**: 点击"创建"后，调用后端 `POST /api/v1/documents`，成功后重定向 (Router Push) 到 `/document/[id]/chapter/...`（默认第一章）。

### 5.2 文档历史页面 (`/documents`)

- **模式**: 网格列表模式 (Grid List Pattern)。
- **UI**: 页面顶部包含"新建文档"主要按钮 (清新绿)。下方为 `DocumentCard` 构成的 Grid 布局 (Responsive: 1列 -> 2列 -> 3列)。
- **数据**: 服务端组件直接请求 `GET /api/v1/documents`，将数据作为 props 传给客户端展示组件。

### 5.3 关键词与摘要编辑页 (`/document/[id]/keyword` & `summary`)

- **模式**: 列表 + 内联编辑 (List + Inline Edit Pattern)。
- **UI**: 左侧为现有的条目列表，右侧为具体条目的编辑详情。
- **交互**: 提供极其显眼的 **"AI 一键提取/生成"** 按钮。调用后端对应接口后，结果展示在页面中供用户确认 (Confirm) 或直接应用 (Apply)。

### 5.4 章节编辑页面 (`/document/[id]/chapter/[chapter_id]`)

- **模式**: 富文本/代码流编辑模式。
- **UI**: 占据中栏最大空间。使用 `MonacoEditorWrapper`。
- **联动设计 (关键)**:
  1. 用户在 Monaco 中圈选一段文字。
  2. 触发 `onChangeSelection` 事件，更新 `zustand` 里的 `selectedText`。
  3. 右侧 `AIChatPanel` 侦听到状态变化，在输入框上方显示"已选中上下文：XXX..."。
  4. 用户对 AI 说："帮我扩写这段话"。
  5. AI 返回流式数据，如果包含 `[ACTION]` 指令（如后端 API 约定），则在 ChatUI 中渲染一个"应用到文档"的按钮。
  6. 点击按钮，将 AI 结果替换 Monaco 中的选中区域。

------

## 6. 状态管理设计 (Zustand)

由于三栏布局中存在大量跨组件通信（例如：在 Middle Pane 选中一段文字，Right Pane 的 AI 助手需要读取该上下文），必须使用全局状态。在 `src/store/` 下拆分模块：

- **`useDocumentStore`** **(文档状态)**
  - `activeDocument`: 当前加载的文档元数据。
  - `toc`: 章节目录树数据（用于 Left Pane 渲染）。
  - `editorContent`: 当前 Middle Pane 正在编辑的段落内容（双向绑定）。
- **`useAIStore`** **(AI 上下文与对话状态)**
  - `messages`: 当前对话流。
  - `selectedContext`: 用户在 Middle Pane 选中的文本、关键词或段落 ID（结构体，用于拼装发给后端的 `selected_paragraphs` 等字段）。
  - `isGenerating`: AI 流式输出状态，用于控制 UI 的 Loading 态。

------

## 7. 技术栈版本说明

| 技术/库 | 版本 | 说明 |
|---------|------|------|
| Next.js | 16.2.1 | App Router 模式 |
| React | 19.2.4 | React 19 最新版 |
| React DOM | 19.2.4 | - |
| Tailwind CSS | 4.2.2 | 使用 `@theme inline` 配置 |
| TypeScript | 5.x | - |
| Zustand | 5.0.12 | 状态管理 |
| @monaco-editor/react | 4.7.0 | Monaco 编辑器 React 封装 |
| monaco-editor | 0.55.1 | 核心编辑器 |
| @chatui/core | 3.6.1 | AI 对话 UI 组件 |
| shadcn/ui | 4.1.0 | UI 组件库 |
| lucide-react | 0.577.0 | 图标库 |

------

## 8. 开发约束与红线 (Constraints)

1. **Monaco Editor SSR 灾难防范**: 绝对禁止在未加 `ssr: false` 的情况下引入 Monaco。统一通过 `src/components/document/MonacoEditorWrapper` 引用。
2. **避免 Props 地狱**: 在三栏布局中，左栏的点击操作、中栏的文本变化、右栏的 AI 回复，**必须**通过 Zustand Store 通信，严禁在 `layout.tsx` 中写一大堆状态然后一层层往下传。
3. **流式响应处理**: AI ChatUI 必须支持 SSE (Server-Sent Events) 的逐步渲染。在 React 中更新流式文本时，注意使用函数式状态更新 (e.g., `setMessages(prev => updateLast(prev, chunk))`) 避免性能卡顿。
4. **防抖与自动保存**: 文档编辑的保存必须做防抖 (Debounce) 处理，建议在 `MonacoEditorWrapper` 内部实现 `useDebounce`，静止 2 秒后自动调用 `PUT` 接口保存段落或章节。
5. **Tailwind v4 适配**: 颜色配置使用 `oklch` 格式，通过 `@theme inline` 定义，而非传统的 `tailwind.config.js`。

------

## 9. 项目初始化状态

当前项目已初始化，包含以下基础结构：

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 根布局 (需要修改 lang="zh")
│   │   ├── page.tsx             # 首页
│   │   └── globals.css          # 全局样式 (Tailwind v4 配置)
│   ├── components/
│   │   └── ui/                  # shadcn/ui 组件
│   └── lib/
│       └── utils.ts             # 工具函数
├── public/                      # 静态资源
├── docs/                        # 文档
├── package.json                 # 依赖
└── ...                          # 配置文件
```

**需要创建的目录结构**:
- `src/app/(overview)/` - 布局组
- `src/app/document/[document_id]/` - 文档编辑路由
- `src/components/document/` - 文档领域组件
- `src/components/chat/` - AI 对话组件
- `src/containers/` - 容器组件
- `src/store/` - Zustand 状态管理
