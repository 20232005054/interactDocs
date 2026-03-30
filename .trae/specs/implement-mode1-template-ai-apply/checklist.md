* [x] `apply_summary_template` 支持 `generation_mode=1` 并能在成功时写入 `DocumentSummary.content`。

* [x] `apply_structure_template` 支持 `generation_mode=1` 并能在章节创建后生成正文段落。

* [x] `sources` 的 `keyinfo/summary/chapter` 映射可正确取数并注入提示词变量。

* [x] `custom_prompt` 优先于 `default_prompt`，二者均为空时有安全兜底策略。

* [x] AI调用统一走同一客户端封装，具备超时、重试、并发上限控制。

* [x] 单条AI生成失败不会导致整次“应用模板”流程失败，且有可追踪日志。

* [x] mode0 行为保持兼容，不因 mode1 改造产生回归问题。

* [x] 接口联调或自动化验证覆盖摘要/结构模板的 mode0、mode1 与异常分支。

