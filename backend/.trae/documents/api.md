# 后端API文档

## 1. 文档管理

### 1.1 创建文档
- **路径**: `/api/v1/documents`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "title": "文档标题",
    "purpose": "使用目的",
    "template_id": "模板ID"
  }
  ```
- **响应**:
  ```json
  {
    "document_id": "uuid",
    "title": "文档标题",
    "purpose": "使用目的",
    "template_id": "模板ID",
    "created_at": "2026-03-18T08:00:00"
  }
  ```

### 1.2 获取文档列表
- **路径**: `/api/v1/documents`
- **方法**: `GET`
- **响应**:
  ```json
  [
    {
      "document_id": "uuid",
      "title": "文档标题",
      "purpose": "使用目的",
      "created_at": "2026-03-18T08:00:00"
    }
  ]
  ```

## 2. 章节管理

### 2.1 创建章节
- **路径**: `/api/v1/chapters`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "document_id": "文档ID",
    "title": "章节标题",
    "order_index": 0
  }
  ```
- **响应**:
  ```json
  {
    "chapter_id": "uuid",
    "document_id": "文档ID",
    "title": "章节标题",
    "order_index": 0
  }
  ```

### 2.2 获取章节详情
- **路径**: `/api/v1/chapters/{chapter_id}`
- **方法**: `GET`
- **响应**:
  ```json
  {
    "chapter_id": "uuid",
    "document_id": "文档ID",
    "title": "章节标题",
    "order_index": 0,
    "paragraphs": [
      {
        "paragraph_id": "uuid",
        "content": "段落内容",
        "para_type": "paragraph",
        "order_index": 0
      }
    ]
  }
  ```

## 3. 段落管理

### 3.1 创建段落
- **路径**: `/api/v1/paragraphs`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "chapter_id": "章节ID",
    "content": "段落内容",
    "para_type": "paragraph",
    "order_index": 0
  }
  ```
- **响应**:
  ```json
  {
    "paragraph_id": "uuid",
    "chapter_id": "章节ID",
    "content": "段落内容",
    "para_type": "paragraph",
    "order_index": 0
  }
  ```

### 3.2 更新段落
- **路径**: `/api/v1/paragraphs/{paragraph_id}`
- **方法**: `PUT`
- **请求体**:
  ```json
  {
    "content": "新段落内容"
  }
  ```
- **响应**:
  ```json
  {
    "paragraph_id": "uuid",
    "content": "新段落内容",
    "para_type": "paragraph"
  }
  ```

## 4. 摘要管理

### 4.1 创建摘要
- **路径**: `/api/v1/summaries`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "document_id": "文档ID",
    "title": "摘要标题",
    "content": "摘要内容",
    "order_index": 0
  }
  ```
- **响应**:
  ```json
  {
    "summary_id": "uuid",
    "document_id": "文档ID",
    "title": "摘要标题",
    "content": "摘要内容",
    "order_index": 0
  }
  ```

### 4.2 AI生成摘要
- **路径**: `/api/v1/summaries/generate`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "document_id": "文档ID",
    "paragraph_ids": ["段落ID1", "段落ID2"]
  }
  ```
- **响应**: 流式SSE响应

## 5. 关键词管理

### 5.1 创建关键词
- **路径**: `/api/v1/keywords`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "document_id": "文档ID",
    "keyword": "关键词"
  }
  ```
- **响应**:
  ```json
  {
    "keyword_id": "uuid",
    "document_id": "文档ID",
    "keyword": "关键词"
  }
  ```

### 5.2 获取文档关键词
- **路径**: `/api/v1/keywords/document/{document_id}`
- **方法**: `GET`
- **响应**:
  ```json
  [
    {
      "keyword_id": "uuid",
      "keyword": "关键词"
    }
  ]
  ```

## 6. 模板管理

### 6.1 创建模板
- **路径**: `/api/v1/templates`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "user_id": "用户ID",
    "purpose": "使用目的",
    "name": "模板名称",
    "content": "模板内容",
    "is_system": false
  }
  ```
- **响应**:
  ```json
  {
    "template_id": "uuid",
    "user_id": "用户ID",
    "purpose": "使用目的",
    "name": "模板名称",
    "content": "模板内容",
    "is_system": false
  }
  ```

### 6.2 获取模板列表
- **路径**: `/api/v1/templates`
- **方法**: `GET`
- **查询参数**:
  - `purpose`: 使用目的
  - `is_system`: 是否系统模板
  - `is_active`: 是否激活
- **响应**:
  ```json
  [
    {
      "template_id": "uuid",
      "name": "模板名称",
      "purpose": "使用目的",
      "is_system": false,
      "created_at": "2026-03-18T08:00:00"
    }
  ]
  ```

## 7. AI辅助功能

### 7.1 AI帮填段落
- **路径**: `/api/v1/ai/assist-paragraph/{paragraph_id}`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "keywords": ["关键词ID1", "关键词ID2"],
    "summary_sections": ["摘要ID1", "摘要ID2"]
  }
  ```
- **响应**: 流式SSE响应

### 7.2 AI评估段落
- **路径**: `/api/v1/ai/evaluate-paragraph/{paragraph_id}`
- **方法**: `GET`
- **响应**: 流式SSE响应
