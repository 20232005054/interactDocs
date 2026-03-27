# 管理员模板管理页面 - 实现计划

## [x] Task 1: 创建模板管理页面路由和基础结构
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在前端项目中创建模板管理页面的路由
  - 创建页面的基础结构和布局
  - 集成现有的UI组件
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 页面路由正确，布局合理
  - `human-judgement` TR-1.2: 页面风格与现有系统一致
- **Notes**: 使用Next.js的app路由系统

## [x] Task 2: 实现模板列表和筛选功能
- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - 实现模板列表的获取和展示
  - 实现按用途、是否系统模板、是否激活的筛选功能
  - 实现模板的分页显示
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 模板列表正确加载
  - `programmatic` TR-2.2: 筛选功能正常工作
  - `human-judgement` TR-2.3: 列表显示美观，操作便捷
- **Notes**: 使用useEffect和useState管理数据和状态

## [x] Task 3: 实现模板创建和编辑功能
- **Priority**: P0
- **Depends On**: Task 2
- **Description**:
  - 创建模板创建和编辑的表单组件
  - 实现表单验证
  - 调用后端API实现模板的创建和更新
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 模板创建功能正常
  - `programmatic` TR-3.2: 模板编辑功能正常
  - `human-judgement` TR-3.3: 表单界面友好，验证提示清晰
- **Notes**: 使用Modal组件实现表单的弹出

## [x] Task 4: 实现模板删除功能
- **Priority**: P0
- **Depends On**: Task 2
- **Description**:
  - 实现模板删除的确认对话框
  - 调用后端API实现模板的删除
  - 处理删除后的列表更新
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: 模板删除功能正常
  - `human-judgement` TR-4.2: 删除确认流程合理
- **Notes**: 使用confirm对话框防止误操作

## [x] Task 5: 实现模板详情页面
- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - 创建模板详情页面
  - 实现标签页切换（核心信息模板、结构模板、摘要模板）
  - 实现页面导航和返回功能
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-7
- **Test Requirements**:
  - `human-judgement` TR-5.1: 页面结构清晰，标签页切换流畅
  - `human-judgement` TR-5.2: 导航功能正常
- **Notes**: 使用Tabs组件实现标签页

## [x] Task 6: 实现核心信息模板管理功能
- **Priority**: P0
- **Depends On**: Task 5
- **Description**:
  - 实现核心信息模板的列表展示
  - 实现核心信息模板的添加、编辑、删除
  - 支持不同类型字段的配置
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: 核心信息模板CRUD操作正常
  - `human-judgement` TR-6.2: 字段类型配置界面友好
- **Notes**: 支持text/number/date/select四种字段类型

## [x] Task 7: 实现结构模板管理功能
- **Priority**: P0
- **Depends On**: Task 5
- **Description**:
  - 实现结构模板的树形展示
  - 实现结构模板的添加、编辑、删除
  - 支持设置父子关系和层级
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: 结构模板CRUD操作正常
  - `human-judgement` TR-7.2: 树形结构展示清晰，编辑便捷
- **Notes**: 使用树形组件实现结构展示

## [x] Task 8: 实现摘要模板管理功能
- **Priority**: P0
- **Depends On**: Task 5
- **Description**:
  - 实现摘要模板的列表展示
  - 实现摘要模板的添加、编辑、删除
  - 支持设置生成方式和提示词
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-8.1: 摘要模板CRUD操作正常
  - `human-judgement` TR-8.2: 界面操作便捷
- **Notes**: 支持复制和AI总结两种生成方式

## [x] Task 9: 实现模板回退功能
- **Priority**: P1
- **Depends On**: Task 2
- **Description**:
  - 为官方模板添加回退按钮
  - 实现回退确认对话框
  - 调用后端API实现模板回退
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-9.1: 模板回退功能正常
  - `human-judgement` TR-9.2: 回退流程合理
- **Notes**: 仅对官方模板显示回退按钮

## [x] Task 10: 实现模板用途管理功能
- **Priority**: P1
- **Depends On**: Task 2
- **Description**:
  - 实现模板用途的获取和展示
  - 支持按用途筛选模板
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-10.1: 用途列表正确加载
  - `programmatic` TR-10.2: 按用途筛选功能正常
- **Notes**: 用途筛选作为模板列表的筛选条件之一
