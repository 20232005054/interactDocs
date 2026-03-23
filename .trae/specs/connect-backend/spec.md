# 前端连接后端 API 规格说明

## Why
当前前端创建文档页面使用模拟数据，需要连接真实后端 API 来获取模板用途列表、模板列表，并创建文档。

## What Changes
- 修改创建文档页面，调用后端 API 获取用途列表和模板列表
- 实现文档创建功能，调用 POST /api/v1/documents
- 添加加载状态和错误处理

## Impact
- 影响文件: frontend/src/app/(overview)/document/page.tsx
- 新增 API 调用: 用途列表、模板列表、创建文档

## ADDED Requirements

### Requirement: 获取用途列表
The system SHALL 从后端获取文档用途列表

#### Scenario: 成功获取
- **WHEN** 页面加载时
- **THEN** 调用 GET /api/v1/templates/purposes/list?is_system=true
- **AND** 显示用途下拉选项

#### Scenario: 获取失败
- **WHEN** API 调用失败
- **THEN** 显示错误提示，使用默认选项

### Requirement: 获取模板列表
The system SHALL 根据选中的用途获取模板列表

#### Scenario: 成功获取
- **WHEN** 用户选择用途后
- **THEN** 调用 GET /api/v1/templates/?purpose={purpose}&is_system=true&is_active=true
- **AND** 显示模板下拉选项

#### Scenario: 无模板
- **WHEN** 该用途下无模板
- **THEN** 显示"暂无模板"提示

### Requirement: 创建文档
The system SHALL 调用 API 创建新文档

#### Scenario: 创建成功
- **WHEN** 用户填写表单并提交
- **THEN** 调用 POST /api/v1/documents
- **AND** 成功后跳转到文档编辑页

#### Scenario: 创建失败
- **WHEN** API 返回错误
- **THEN** 显示错误信息，保留表单数据

## API 接口

### 1. 获取用途列表
```
GET /api/v1/templates/purposes/list?is_system=true

Response:
{
  "items": [
    { "id": "purpose_id", "name": "用途名称" }
  ]
}
```

### 2. 获取模板列表
```
GET /api/v1/templates/?purpose={purpose}&is_system=true&is_active=true

Response:
{
  "items": [
    { "id": "template_id", "name": "模板名称" }
  ]
}
```

### 3. 创建文档
```
POST /api/v1/documents

Request:
{
  "title": "string",
  "purpose": "用途ID",
  "template_id": "模板ID"
}

Response:
{
  "id": "document_id",
  "title": "string",
  ...
}
```
