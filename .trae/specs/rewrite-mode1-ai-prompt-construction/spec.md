# 重写 Mode1 AI 提示词组装逻辑 Spec

## Why
目前 AI 总结生成（mode=1）依赖 `default_prompt` 和 `custom_prompt` 中包含 `{{}}` 占位符来进行变量替换。然而，用户的提示词是纯文本，不包含占位符。我们需要重写提示词的组装逻辑，将纯文本提示词与通过 `sources` 提取到的数据进行拼接，以便为 AI 提供完整的上下文。

## What Changes
- 修改 `SummaryTemplateService` 和 `StructureTemplateService` 中的 `render_ai_content` 方法。
- 放弃原有的正则替换或模板格式化方式，改为动态拼接提示词。
- 新的提示词结构应包括：基础指令（优先使用 `custom_prompt`，其次 `default_prompt`）+ 提取到的 `source_data_map` 数据结构（例如 Markdown 列表或 JSON 格式）。
- 确保 AI 模型能理解并结合给定的数据执行用户指令。

## Impact
- Affected specs: 无
- Affected code: 
  - `backend/services/summary_template_service.py`
  - `backend/services/structure_template_service.py`

## ADDED Requirements
### Requirement: 动态提示词组装
系统 SHALL 将基础指令（纯文本）与提取到的数据源进行拼接，构建最终的 AI 提示词。

#### Scenario: 成功生成提示词
- **WHEN** 应用模式 1 的模板时
- **THEN** AI 接收到的提示词包含了用户的指令以及通过 `sources` 提取到的相关数据。

## MODIFIED Requirements
### Requirement: 提示词变量替换
**Reason**: 用户提供的提示词不再包含 `{{}}` 占位符。
**Migration**: 将替换逻辑改为追加/结构化拼接逻辑。