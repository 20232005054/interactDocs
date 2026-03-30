# Tasks
- [x] Task 1: 统一Mode1上下文与提示词渲染能力
  - [x] SubTask 1.1: 新增模板AI渲染服务，统一处理 `sources` 解析、变量装配、`custom/default_prompt` 选择与渲染。
  - [x] SubTask 1.2: 定义并实现 `keyinfo/summary/chapter` 三类来源的取数规则与空值策略。
  - [x] SubTask 1.3: 为渲染层补充单元测试，验证变量注入与兜底提示词逻辑。

- [x] Task 2: 落地摘要模板Mode1执行分支
  - [x] SubTask 2.1: 在 `apply_summary_template` 增加 `generation_mode=1` 分支并接入统一AI调用入口。
  - [x] SubTask 2.2: 成功生成时写入 `DocumentSummary.content`，失败时执行降级并保留可追踪错误信息。
  - [x] SubTask 2.3: 增加接口级验证，确认“应用摘要模板”在 mode0/mode1 下行为正确。

- [x] Task 3: 落地结构模板Mode1执行分支
  - [x] SubTask 3.1: 在 `apply_structure_template` 增加 `generation_mode=1` 分支，章节创建后自动生成正文段落。
  - [x] SubTask 3.2: 保证章节父子关系与排序逻辑不受影响，仅扩展内容填充流程。
  - [x] SubTask 3.3: 增加接口级验证，确认“应用结构模板”在 mode1 可生成段落内容。

- [x] Task 4: 强化AI调用治理与可观测性
  - [x] SubTask 4.1: 收敛分散调用到统一客户端，补充超时、重试、并发上限配置。
  - [x] SubTask 4.2: 增加生成日志字段（模板ID、field_key、耗时、错误码），便于排障与追踪。
  - [x] SubTask 4.3: 增加失败回归验证，确保单条生成失败不阻断整次模板应用。

- [x] Task 5: 全链路验证与文档同步
  - [x] SubTask 5.1: 执行后端测试与关键接口联调，覆盖 mode0/mode1 与异常分支。
  - [x] SubTask 5.2: 更新相关说明文档，明确 mode1 行为、降级策略与性能注意事项。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3 and Task 4
