# Add Core Info Hierarchy Spec

## Why
当前 `CoreInfoTemplate` 和 `DocumentCoreInfo` 仅支持平铺结构。为了支持层级目录（如“评价指标”下设两级目录“主要评价指标”、“次要评价指标”），提升文档核心信息的可读性和前端界面的渲染灵活性，需要引入树形结构。

## What Changes
- 在 `CoreInfoTemplate` 模型中增加 `parent_id` 字段（自关联外键），并配置 `children` 关系属性。
- 在 `DocumentCoreInfo` 模型中增加 `parent_id` 字段（自关联外键），并配置 `children` 关系属性。
- **BREAKING**: 返回核心信息的接口 Schema 需要从一维数组变更为支持嵌套 `children` 的树形结构。

## Impact
- Affected specs: 核心信息模板管理、文档核心信息操作。
- Affected code:
  - `backend/db/models.py`
  - 后端对应的 Schema 定义（如 Pydantic schemas）
  - 后端相关的 CRUD 及路由逻辑

## ADDED Requirements
### Requirement: 层级核心信息管理
系统需支持通过 `parent_id` 记录和还原核心信息及模板的多级父子层级关系。

#### Scenario: 创建包含层级的模板
- **WHEN** 用户创建一个具有父级标识的模板字段
- **THEN** 系统将其 `parent_id` 关联至父节点，查询时以树形结构返回，并且能够随父节点级联删除。

## MODIFIED Requirements
### Requirement: 核心信息展示
原有的顺序排列需要改为基于树形结构的同级排序，并在接口中以嵌套 JSON 格式返回，以便前端能够渲染树形组件或折叠面板。