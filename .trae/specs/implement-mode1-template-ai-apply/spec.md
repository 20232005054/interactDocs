# Mode1模板应用AI生成 Spec

## Why
当前“应用模板”流程仅实现了 `generation_mode=0` 的复制模式，`mode=1` 虽有字段设计但没有执行分支，导致摘要/章节在模板应用后无法自动生成内容。需要补齐一条可观测、可降级、可扩展的 `mode=1` 生成链路。

## What Changes
- 在文档模板应用流程中新增 `generation_mode=1` 分支，应用时直接触发AI生成。
- 新增统一的模板AI渲染服务：负责 `sources` 取数、上下文组装、提示词渲染、模型调用与错误封装。
- 摘要模板 `mode=1`：基于 `custom_prompt/default_prompt + sources` 生成并写入 `DocumentSummary.content`。
- 结构模板 `mode=1`：在创建章节后自动生成正文段落并写入 `Paragraph`。
- 引入统一的超时、重试、并发上限、失败降级与日志追踪策略，避免整次应用模板失败。
- 统一AI调用入口，减少分散直调，确保行为一致与后续替换模型成本可控。

## Impact
- Affected specs: 模板应用、摘要生成、章节内容初始化、AI调用治理。
- Affected code:
  - `backend/services/document_service.py`
  - `backend/services/summary_template_service.py`
  - `backend/services/structure_template_service.py`
  - `backend/services/ai_client.py`
  - `backend/services/ai_service.py`
  - `backend/db/mappers/paragraph_mapper.py`（如需复用/扩展）

## ADDED Requirements
### Requirement: 模板应用支持Mode1即时AI生成
The system SHALL 在执行“应用摘要模板/应用结构模板”时，当模板 `generation_mode=1` 时即时触发AI生成并回写结果。

#### Scenario: Summary mode1 success
- **WHEN** 用户对文档执行“应用摘要模板”，且某条摘要模板 `generation_mode=1`。
- **THEN** 系统读取该模板的 `sources` 与 `custom_prompt/default_prompt`，完成变量注入并调用AI生成内容，成功写入对应 `DocumentSummary.content`。

#### Scenario: Structure mode1 success
- **WHEN** 用户对文档执行“应用结构模板”，且某个结构模板节点 `generation_mode=1`。
- **THEN** 系统在创建章节后自动生成正文内容并创建对应段落，章节结构与父子关系保持不变。

#### Scenario: Generation degraded safely
- **WHEN** AI调用超时、失败或返回空结果。
- **THEN** 系统记录可追踪错误信息并进行安全降级（保留空内容或占位内容），且本次模板应用主流程不整体失败。

### Requirement: sources驱动的上下文构建与提示词渲染
The system SHALL 基于模板 `sources` 统一构建上下文变量，并渲染 `custom_prompt`（优先）或 `default_prompt`（兜底）。

#### Scenario: sources mapping success
- **WHEN** `sources` 中包含 `keyinfo/summary/chapter` 的映射项。
- **THEN** 系统按 `match_key -> target_field` 取值并注入模板变量，生成最终prompt后调用AI。

## MODIFIED Requirements
### Requirement: 应用模板接口的行为语义
现有“应用模板”接口在 `mode=0` 下保持原有复制行为，在 `mode=1` 下改为“创建结构/记录 + AI即时填充”的复合行为，并提供可观测的生成结果状态。

## REMOVED Requirements
### Requirement: Mode1仅保留空内容初始化
**Reason**: 该行为导致模板定义与运行结果不一致，无法满足“应用即可用”的业务预期。  
**Migration**: 保留向后兼容降级逻辑；若AI失败，仍允许空内容落库并记录错误，避免阻断业务流程。
