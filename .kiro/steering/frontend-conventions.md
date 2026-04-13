# 前端开发约束规范

本规范适用于 InteractiveDocs 前端（Next.js + TypeScript + Tailwind + shadcn + Zustand）。
每次编写前端代码前必须遵守以下约束，不得偏离。

---

## 1. 目录结构

```
src/
  app/          # 仅放路由页面（page.tsx / layout.tsx），不写业务逻辑
  components/   # 可复用 UI 组件，按功能域分子目录
  containers/   # 页面级容器组件，负责数据获取和状态编排
  services/     # 所有后端接口调用，按业务域分文件
  store/        # Zustand 全局状态，按业务域分文件
  hooks/        # 公共自定义 hooks
  lib/          # 纯工具函数，无副作用
  types/        # 全局 TypeScript 类型定义
```

**禁止：**
- 在 `app/` 的 page 文件里直接写接口调用或复杂业务逻辑
- 在组件里直接写 `fetch` / `axios`，必须经过 `services/` 层

---

## 2. 接口调用规范

- 所有请求必须经过 `services/` 层封装，组件/容器只调用 service 函数
- axios 统一封装在 `lib/request.ts`，配置 baseURL 和拦截器
- 响应拦截器统一处理：`code !== 200` 时 toast 错误信息并 `Promise.reject`
- token 在请求拦截器里统一注入，不在业务代码里手动加 header

```ts
// 正确
const documents = await documentService.list({ page: 1, pageSize: 10 })

// 禁止
const res = await axios.get('/api/v1/documents', { headers: { Authorization: `Bearer ${token}` } })
```

---

## 3. 接口选择原则

- **操作用细粒度接口**：拖拽排序调 `reorder`，单字段修改调 `PUT /{id}`，不用全量刷新
- **初始加载并发请求**：进入页面需要多份数据时，用 `Promise.all` 并发，不串行
- **有 SSE 的地方不轮询**：文档变更事件通过 `GET /documents/{id}/events` 订阅，不定时拉取
- **乐观更新**：后端异步联动（核心信息变更触发摘要重新生成）不阻塞 UI，通过 SSE 事件同步结果

---

## 4. 状态管理规范

**Zustand store 拆分：**
- `useAuthStore` — token、当前用户信息
- `useDocumentStore` — 当前文档、章节树、核心信息、摘要列表
- `useChatStore` — 对话历史、流式内容缓冲
- `useEditorStore` — 当前选中章节、编辑器光标状态

**约束：**
- store 只放需要跨组件共享的状态，组件内部状态用 `useState`
- store 里不写异步请求逻辑，异步操作在容器组件或 hooks 里发起，结果写入 store
- 禁止在 store 里 import 组件，禁止循环依赖

---

## 5. 组件复用原则

- 相同 UI + 相同数据结构 + 相同行为，三者都满足才抽成公共组件
- 相同逻辑出现 **2 次以上** 才抽成 hook 或 util，不过早抽象
- 优先使用 shadcn 组件库，不重复造轮子
- 章节树和核心信息树结构相同，抽成通用 `<TreeView>` 组件复用

---

## 6. 样式规范

- **只用 Tailwind 类名**，不写内联 `style={{}}`，不写独立 `.css` / `.module.css` 文件
- 间距、颜色、字号使用 Tailwind 设计系统，不写魔法数字（如 `mt-[13px]`）
- 响应式用 Tailwind 断点（`sm:` `md:` `lg:`），不写 media query
- 动态类名用 `cn()` 工具函数合并，不用字符串拼接

---

## 7. 加载与错误状态

每个异步操作必须处理三种状态，不得裸调接口：

```ts
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const load = async () => {
  setLoading(true)
  setError(null)
  try {
    const data = await someService.fetch()
    // 更新状态
  } catch (err: any) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
```

- loading 状态用 skeleton 或 inline spinner，**不用全屏遮罩**（编辑器产品操作频繁）
- 破坏性操作（删除、覆盖）必须有确认弹窗
- 错误信息展示给用户时用中文，不暴露技术细节

---

## 8. SSE 流式内容处理

- AI 对话和 AI 帮填使用 SSE，用 `EventSource` 或手动 `fetch` + `ReadableStream` 消费
- 流式内容渐进渲染到 UI，不等全部接收完再显示
- 连接断开时自动重连，重连间隔指数退避
- 文档变更事件（`summary_updated` / `paragraph_updated`）收到后，调对应 service 拉取最新数据更新 store

---

## 9. TypeScript 规范

- 所有函数参数和返回值必须有类型，禁止 `any`（特殊情况加注释说明）
- 后端接口响应类型定义在 `types/api.ts`，与后端字段名保持一致
- 组件 props 用 `interface` 定义，不用 `type`（保持一致性）
- 枚举值与后端 `constants.py` 保持同步

---

## 10. 文件命名

- 组件文件：`PascalCase.tsx`（如 `ChapterTree.tsx`）
- hooks：`camelCase.ts`，以 `use` 开头（如 `useSSE.ts`）
- service 文件：`camelCase.ts`（如 `documentService.ts`）
- store 文件：`camelCase.ts`（如 `documentStore.ts`）
- 工具函数：`camelCase.ts`（如 `formatDate.ts`）
