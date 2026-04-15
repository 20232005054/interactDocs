# 后端开发约束规范

本规范适用于 InteractiveDocs 后端（FastAPI + SQLAlchemy async + Pydantic + PostgreSQL）。
每次编写后端代码前必须遵守以下约束，不得偏离。

---

## 1. 目录结构

```
backend/
  api/v1/         # 路由层，只做参数解析、调用 service、组装响应
  services/       # 业务逻辑层，跨 mapper 的编排逻辑写在这里
  db/
    models.py     # SQLAlchemy ORM 模型，只定义表结构
    mappers/      # 数据访问层，每个文件对应一张表，只写 SQL/ORM 查询
  schemas/
    schemas.py    # 请求体 Pydantic 模型（Create / Update / Payload）
    response_schemas.py  # 响应体 Pydantic 模型（Response / ListResponse）
  core/           # 全局配置、认证、常量、响应工具
```

**禁止：**
- 在 `api/v1/` 路由函数里直接写 ORM 查询，必须经过 service 或 mapper
- 在 `mappers/` 里写业务逻辑（如条件判断、多表联动），mapper 只做数据读写
- 在 `models.py` 里写业务方法

---

## 2. 分层职责

**路由层（api/v1/）：**
- 解析请求参数，调用 service，用 response schema 组装返回值
- 不写 ORM 查询，不写业务判断
- 每个路由必须声明 `response_model`

**Service 层：**
- 业务逻辑、跨表编排、事务控制
- 抛出 `HTTPException` 而不是返回错误码
- 不直接操作 ORM，通过 mapper 访问数据库

**Mapper 层：**
- 单表 CRUD 和简单查询
- 联表查询允许，但不写业务判断
- 每个方法职责单一，命名清晰（`get_by_id` / `list_by_xxx` / `create` / `update` / `delete`）

---

## 3. 响应规范

所有接口统一使用 `success_response` 包装，格式为：

```python
{"code": 200, "message": "成功", "data": ...}
```

- 每个路由必须声明 `response_model=ResponseModel[XxxResponse]`
- 无数据返回的接口（删除、重排）用 `response_model=ResponseModel[None]`
- 错误通过 `raise HTTPException(status_code=xxx, detail="中文描述")` 抛出，由全局 handler 统一处理
- 不在业务代码里手动构造错误响应 dict

---

## 4. 数据库 Session 规范

**普通接口：** 通过 `Depends(get_db)` 注入 session，FastAPI 自动管理生命周期。

**SSE / 流式接口：** 不能在整个流式输出期间持有 session，必须三阶段分离：

```python
# 阶段1：准备数据，用完立即释放
async with AsyncSessionLocal() as db:
    data = await fetch_data(db)

# 阶段2：流式输出，不持有任何 db 连接
async for chunk in call_ai_stream(data):
    yield chunk

# 阶段3：保存结果，独立 session
async with AsyncSessionLocal() as db:
    await save_result(db, result)
```

**commit 时机：**
- mapper 的 `create` / `update` / `delete` 方法负责 commit
- service 在多步操作后统一 commit，不在每个 mapper 调用后单独 commit
- `flush` 用于需要获取自增 ID 但还未提交的场景

---

## 5. 异步规范

- 所有数据库操作必须用 `await`，不能用同步 SQLAlchemy
- 同步阻塞操作（文件 IO、同步 SDK 调用）必须用 `asyncio.to_thread` 包装
- **SSE 流式迭代同步 generator 时，必须在线程里迭代**，不能在事件循环里直接 `for` 迭代同步 generator，否则会阻塞整个事件循环

```python
# 禁止：阻塞事件循环
for chunk in sync_generator:
    yield chunk

# 正确：在线程里迭代，通过 queue 传递给事件循环
loop.run_in_executor(None, producer_thread, sync_generator, queue, loop)
while True:
    item = await queue.get()
    if item is None:
        break
    yield item
```

---

## 6. Import 规范

- 所有 import 放在文件顶部，不在函数体内 import（循环依赖除外，需加注释说明）
- 禁止使用 `__import__("xxx")` 动态导入，改用顶部 import
- 同一模块内的相互引用注意循环依赖，必要时用局部 import 并注释

---

## 7. Schema 规范

- 请求体 schema 放 `schemas/schemas.py`，响应体 schema 放 `schemas/response_schemas.py`
- 字段命名与数据库列名保持一致（snake_case）
- Create schema 必填字段不加 `Optional`，Update schema 所有字段加 `Optional`
- 树形结构的响应 schema 需要 `model_rebuild()` 处理自引用

```python
# 正确
class CoreInfoResponse(BaseModel):
    children: List['CoreInfoResponse'] = []

CoreInfoResponse.model_rebuild()
```

---

## 8. 错误处理规范

- Service 层用 `raise HTTPException(status_code=404, detail="资源不存在")` 抛出业务错误
- 路由层不捕获 `HTTPException`，让全局 handler 处理
- 非预期异常（第三方 SDK 失败、网络错误）在 service 层捕获，转换为 `HTTPException` 或静默处理
- AI 相关接口的错误降级逻辑在 service 层处理，不暴露给路由层

---

## 9. 常量与枚举

- 业务常量统一放 `core/constants.py`，用 `str Enum` 定义
- 前端 `types/api.ts` 里的枚举值必须与 `constants.py` 保持同步
- `generation_mode` 等整数枚举在注释里说明每个值的含义

```python
# generation_mode: 0=复制, 1=AI总结, 2=直接使用, 3=AI修改
```

---

## 10. 文件命名

- 路由文件：`snake_case.py`（如 `core_info_templates.py`）
- Service 文件：`snake_case_service.py`（如 `document_service.py`）
- Mapper 文件：`snake_case_mapper.py`（如 `paragraph_mapper.py`）
- Schema 字段：`snake_case`，与数据库列名一致
