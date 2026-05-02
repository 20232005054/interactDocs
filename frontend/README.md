# InteractiveDocs Frontend

基于 Next.js 的交互式文档写作系统前端应用。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **图标**: Lucide React

## 核心功能

- 文档列表与创建
- 三栏编辑器（章节树、编辑区、信息面板）
- 章节树形结构（拖拽排序、折叠展开）
- 段落 Markdown 编辑
- 核心信息与摘要管理
- AI 对话助手（SSE 流式）
- 文献管理与引用
- 模板管理与应用
- 文档导出（Word/PDF/Markdown）
- 管理后台（用户、文档、统计）

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm / yarn / pnpm

### 2. 安装依赖

```bash
npm install
# 或
yarn install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```env
# 后端 API 地址
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

### 4. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
```

访问 http://localhost:3000

### 5. 构建生产版本

```bash
npm run build
npm run start
```

## 项目结构

```
frontend/src/
├── app/                    # Next.js App Router 页面
│   ├── login/              # 登录页
│   ├── register/           # 注册页
│   ├── documents/          # 文档列表
│   │   └── [id]/           # 文档编辑器
│   ├── my-templates/       # 个人模板库
│   ├── literature/         # 文献管理
│   └── admin/              # 管理后台
├── components/             # 可复用 UI 组件
│   ├── ui/                 # shadcn 基础组件
│   ├── editor/             # 编辑器组件
│   ├── template/           # 模板组件
│   └── literature/         # 文献组件
├── containers/             # 页面级容器组件
│   ├── DocumentListContainer.tsx
│   ├── DocumentEditorContainer.tsx
│   ├── TemplateListContainer.tsx
│   └── LiteratureManagementContainer.tsx
├── services/               # 后端接口调用
│   ├── documentService.ts
│   ├── chapterService.ts
│   ├── paragraphService.ts
│   ├── summaryService.ts
│   ├── coreInfoService.ts
│   ├── templateService.ts
│   ├── literatureService.ts
│   └── aiService.ts
├── store/                  # Zustand 全局状态
│   ├── authStore.ts        # 认证状态
│   ├── documentStore.ts    # 文档状态
│   ├── editorStore.ts      # 编辑器状态
│   └── chatStore.ts        # 聊天状态
├── hooks/                  # 自定义 hooks
│   ├── useToast.ts         # Toast 通知
│   └── useDocumentSSE.ts   # SSE 事件订阅
├── lib/                    # 工具函数
│   ├── request.ts          # Axios 封装
│   └── utils.ts            # 通用工具
└── types/                  # TypeScript 类型定义
    └── api.ts              # API 响应类型
```

## 开发规范

详见 `.kiro/steering/frontend-conventions.md`

**核心原则**：
- `app/` 只放路由页面，不写业务逻辑
- 所有接口调用经过 `services/` 层
- 组件只用 Tailwind 类名，不写内联 style（动态场景除外）
- Store 只放跨组件共享的状态
- 错误处理遵循统一策略（见下文）

## 错误处理策略

详见 `.kiro/steering/error-handling-strategy.md`

| 场景 | 处理方式 |
|---|---|
| 页面加载失败 | `setError` + 重试按钮 |
| 用户主动操作失败 | `toastError` |
| 后台任务/SSE 失败 | 静默失败 |
| 弹窗表单失败 | `setError`（内联显示） |

**示例**：

```typescript
// 页面加载
const [error, setError] = useState<string | null>(null)
const load = async () => {
  setLoading(true)
  setError(null)
  try {
    const data = await service.fetch()
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "加载失败")
  } finally {
    setLoading(false)
  }
}

// 用户操作
const handleDelete = async (id: string) => {
  try {
    await service.delete(id)
    toastSuccess("删除成功")
  } catch (err: unknown) {
    toastError(err instanceof Error ? err.message : "删除失败")
  }
}
```

## 状态管理

### Zustand Store 拆分

- `useAuthStore` - token、当前用户信息
- `useDocumentStore` - 当前文档、章节树、核心信息、摘要列表
- `useChatStore` - 对话历史、上下文管理
- `useEditorStore` - 当前选中章节、右侧面板状态

### 使用原则

- Store 只放需要跨组件共享的状态
- 组件内部状态用 `useState`
- Store 里不写异步请求逻辑
- 异步操作在容器组件或 hooks 里发起

## SSE 实时通信

### 文档变更事件

```typescript
// 订阅文档变更事件
useDocumentSSE({ documentId, enabled: true })

// 事件类型
type SSEEvent = 
  | { type: "summary_updated", summary_id: string }
  | { type: "paragraph_updated", chapter_id: string, paragraph_id: string }
  | { type: "ping" }
```

前端收到事件后主动拉取最新数据，不在 SSE 里传数据。

### AI 流式输出

```typescript
// AI 对话
const result = await aiService.chatStream(
  { message, document_id },
  {
    signal: abortController.signal,
    onChunk: (chunk, accumulated) => {
      // 渐进渲染
      setContent(accumulated)
    }
  }
)
```

## 组件拆分原则

相同 UI + 相同数据结构 + 相同行为，三者都满足才抽成公共组件。

**示例**：
- `AIChatPanel` 拆分为 `ChatMessageList`、`ChatInput`、`ChatContextBar`
- `ChapterTree` 和 `CoreInfoPanel` 复用 `TreeView` 组件

## 样式规范

- **只用 Tailwind 类名**，不写独立 CSS 文件
- 动态场景（树形缩进、可拖动宽度）可用内联 style，需添加注释说明
- 响应式用 Tailwind 断点（`sm:` `md:` `lg:`）
- 动态类名用 `cn()` 工具函数合并

```typescript
// ✅ 正确：动态缩进需要内联 style
<div 
  style={{ paddingLeft: `${depth * 16}px` }}  // 动态树形缩进
  className="..."
>

// ✅ 正确：Tailwind 类名
<div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">

// ❌ 错误：不写独立 CSS
<div className={styles.container}>  // 不使用 CSS Modules
```

## 接口调用规范

### 统一封装

所有请求经过 `lib/request.ts` 封装：

```typescript
// services/documentService.ts
export const documentService = {
  list: (params) => request.get('/api/v1/documents', { params }),
  get: (id) => request.get(`/api/v1/documents/${id}`),
  create: (data) => request.post('/api/v1/documents', data),
  // ...
}
```

### 拦截器

- 请求拦截器：自动注入 token
- 响应拦截器：统一处理错误（`code !== 200` 时 toast 并 reject）

### 并发请求

初始加载需要多份数据时，用 `Promise.all` 并发：

```typescript
const [fullContent, summaries, coreInfo] = await Promise.all([
  chapterService.getFullContent(documentId),
  summaryService.getByDocument(documentId),
  coreInfoService.getByDocument(documentId),
])
```

## 常见问题

**Q: 页面刷新后 token 丢失？**

token 存储在 localStorage，检查 `useAuthStore` 的 `persist` 配置。

**Q: SSE 连接频繁断开？**

检查后端日志，SSE 会自动重连（指数退避）。

**Q: 组件更新不及时？**

检查是否正确订阅了 store 状态：
```typescript
// ✅ 正确
const title = useDocumentStore((state) => state.documentTitle)

// ❌ 错误
const { documentTitle } = useDocumentStore()  // 不会响应更新
```

## 构建优化

- 使用 Next.js Image 组件优化图片
- 动态导入大型组件（`dynamic(() => import(...))`）
- 生产构建自动启用代码分割和压缩

## 部署

### Vercel (推荐)

1. 连接 GitHub 仓库
2. 设置环境变量 `NEXT_PUBLIC_API_BASE_URL`
3. 自动部署

### 自托管

```bash
npm run build
npm run start
# 或使用 PM2
pm2 start npm --name "interactivedocs-frontend" -- start
```

## 开发工具

- ESLint - 代码检查
- Prettier - 代码格式化
- TypeScript - 类型检查

```bash
npm run lint      # 运行 ESLint
npm run type-check  # 运行 TypeScript 检查
```

## 注意事项

1. 所有环境变量必须以 `NEXT_PUBLIC_` 开头才能在客户端访问
2. `.env.local` 不提交到版本库
3. 生产环境需要配置正确的 API 地址
4. SSE 连接需要后端支持 CORS
