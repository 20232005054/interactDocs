---
inclusion: auto
---

# 前端错误处理统一策略

本文档定义 InteractiveDocs 前端的统一错误处理规范，确保用户体验一致。

---

## 错误处理三原则

### 1. 页面加载错误 → `setError` 状态 + 重试按钮

**适用场景**：
- 容器组件初始加载（文档列表、文档编辑器、模板列表等）
- 页面级数据获取失败

**实现模式**：
```typescript
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const load = useCallback(async () => {
  setLoading(true)
  setError(null)
  try {
    const data = await someService.fetch()
    // 更新状态
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "加载失败")
  } finally {
    setLoading(false)
  }
}, [])

// UI 渲染
if (error) {
  return (
    <div className="text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <button onClick={load}>重试</button>
    </div>
  )
}
```

**禁止**：页面加载失败时使用 `toastError`（toast 会自动消失，用户无法重试）

---

### 2. 用户主动操作错误 → `toastError`

**适用场景**：
- 删除、更新、创建等 CRUD 操作
- 导出、导入、上传等文件操作
- 绑定、解绑等关联操作
- 应用模板、同步模板等业务操作

**实现模式**：
```typescript
const handleDelete = async (id: string) => {
  try {
    await someService.delete(id)
    // 更新本地状态
    toastSuccess("删除成功")
  } catch (err: unknown) {
    toastError(err instanceof Error ? err.message : "删除失败")
  }
}
```

**例外**：弹窗表单内的错误使用 `setError` 状态（见原则 4）

---

### 3. 后台任务/SSE 错误 → 静默失败

**适用场景**：
- SSE 连接失败（自动重连）
- 后台轮询失败
- 非关键数据加载失败（如模板依赖、文献列表）
- 自动保存失败（用户未主动触发）

**实现模式**：
```typescript
try {
  const data = await someService.fetch()
  // 更新状态
} catch {
  // 静默失败，不显示错误
  // 可选：console.error 用于调试
}
```

**原因**：
- SSE 会自动重连，不需要打扰用户
- 非关键数据失败不应阻断主流程
- 后台任务失败通过 SSE 事件通知，不需要立即提示

---

### 4. 弹窗表单错误 → `setError` 状态（内联显示）

**适用场景**：
- 创建文档弹窗
- 编辑弹窗（重命名、编辑文献等）
- 上传弹窗
- 任何模态对话框内的表单提交

**实现模式**：
```typescript
const [error, setError] = useState<string | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!validate()) {
    setError("请填写必填项")
    return
  }
  
  setLoading(true)
  setError(null)
  try {
    await someService.create(data)
    onSuccess()
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "操作失败")
  } finally {
    setLoading(false)
  }
}

// UI 渲染
{error && <p className="text-sm text-red-500">{error}</p>}
```

**原因**：
- 弹窗内的错误应该显示在弹窗内，不应该用 toast（toast 可能被弹窗遮挡）
- 用户需要看到错误信息才能修正输入

---

## 错误消息规范

### 1. 错误消息格式

```typescript
// ✅ 正确：简洁、中文、用户友好
catch (err: unknown) {
  toastError(err instanceof Error ? err.message : "删除失败")
}

// ❌ 错误：暴露技术细节
catch (err: unknown) {
  toastError(`Error: ${err}`)
}
```

### 2. 后端错误消息

后端已统一返回中文错误消息，前端直接使用：
```typescript
err instanceof Error ? err.message : "操作失败"
```

### 3. 兜底消息

每个 catch 块必须提供兜底消息：
```typescript
// ✅ 正确
catch (err: unknown) {
  setError(err instanceof Error ? err.message : "加载失败")
}

// ❌ 错误：没有兜底消息
catch (err: unknown) {
  setError(err.message)  // err 可能不是 Error 类型
}
```

---

## 常见场景示例

### 场景 1：文档列表加载

```typescript
// ✅ 正确：页面加载错误 → setError + 重试
const [error, setError] = useState<string | null>(null)

const load = useCallback(async () => {
  setLoading(true)
  setError(null)
  try {
    const res = await documentService.list({ page, page_size: pageSize })
    setItems(res.items)
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "加载失败")
  } finally {
    setLoading(false)
  }
}, [page])

if (error) {
  return <div>{error} <button onClick={load}>重试</button></div>
}
```

### 场景 2：删除文档

```typescript
// ✅ 正确：用户操作 → toastError
const handleDelete = async (id: string) => {
  try {
    await documentService.delete(id)
    setItems(prev => prev.filter(d => d.document_id !== id))
  } catch (err: unknown) {
    toastError(err instanceof Error ? err.message : "删除失败")
  }
}
```

### 场景 3：SSE 连接

```typescript
// ✅ 正确：后台任务 → 静默失败 + 自动重连
.catch(err => {
  if (!mountedRef.current) return
  if (err?.name === "AbortError") return
  
  // 静默失败，自动重连
  const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000)
  retryCountRef.current += 1
  retryTimerRef.current = setTimeout(() => {
    if (mountedRef.current) connect()
  }, delay)
})
```

### 场景 4：创建文档弹窗

```typescript
// ✅ 正确：弹窗表单 → setError（内联显示）
const [error, setError] = useState<string | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!title.trim()) {
    setError("请填写文档标题")
    return
  }
  
  setLoading(true)
  setError(null)
  try {
    const doc = await documentService.create({ title, template_id: templateId })
    onCreated(doc)
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "创建失败")
  } finally {
    setLoading(false)
  }
}

// UI
{error && <p className="text-sm text-red-500">{error}</p>}
```

### 场景 5：非关键数据加载

```typescript
// ✅ 正确：非关键数据 → 静默失败
useEffect(() => {
  literatureService.list().then(res => {
    setAllLiterature(res.items)
  }).catch(() => {
    // 静默失败，不影响主流程
  }).finally(() => setLitLoading(false))
}, [])
```

---

## 检查清单

在编写错误处理代码时，问自己：

1. **这是页面加载吗？** → 用 `setError` + 重试按钮
2. **这是用户主动操作吗？** → 用 `toastError`
3. **这是后台任务/SSE 吗？** → 静默失败
4. **这是弹窗表单吗？** → 用 `setError`（内联显示）
5. **错误消息是中文且用户友好吗？**
6. **有兜底消息吗？**（`"操作失败"`）

---

## 禁止的模式

```typescript
// ❌ 禁止：页面加载用 toastError
const load = async () => {
  try {
    const data = await service.fetch()
  } catch (err) {
    toastError(err.message)  // ❌ 应该用 setError + 重试
  }
}

// ❌ 禁止：空 catch 块（除非是静默失败场景）
try {
  await service.update()
} catch {
  // ❌ 什么都不做，用户不知道失败了
}

// ❌ 禁止：暴露技术细节
catch (err) {
  toastError(`Error: ${err.stack}`)  // ❌ 用户看不懂
}

// ❌ 禁止：没有类型检查
catch (err) {
  setError(err.message)  // ❌ err 可能不是 Error 类型
}
```

---

## 总结

| 场景 | 处理方式 | 原因 |
|---|---|---|
| 页面加载失败 | `setError` + 重试按钮 | 用户需要重试，toast 会消失 |
| 用户主动操作失败 | `toastError` | 即时反馈，不阻断流程 |
| 后台任务/SSE 失败 | 静默失败 | 自动重连，不打扰用户 |
| 弹窗表单失败 | `setError`（内联） | 错误应显示在弹窗内 |
| 非关键数据失败 | 静默失败 | 不影响主流程 |

**核心原则**：错误处理应该对用户友好、一致、不打扰。
