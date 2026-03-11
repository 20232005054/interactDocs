# 方案生成系统接口测试文档

## 1. 测试环境

### 1.1 基础路径

所有接口的基础路径为：`http://localhost:8001/api/v1`

### 1.2 请求头

| 头部名称          | 值                | 描述                  |
| ------------- | ---------------- | ------------------- |
| Content-Type  | application/json | 请求体格式               |
| Authorization | Bearer {token}   | JWT 认证令牌（可选，部分接口需要） |

## 2. 接口测试详情

### 2.1 用户管理模块

#### 2.1.1 用户登录

* **测试网址**：`http://localhost:8001/api/v1/users/login`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

* **请求体**：

  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer",
      "user_id": "12345678-1234-1234-1234-123456789012"
    }
  }
  ```

#### 2.1.2 用户注册

* **测试网址**：`http://localhost:8001/api/v1/users/register`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

* **请求体**：

  ```json
  {
    "email": "test@example.com",
    "password": "password123",
    "name": "测试用户"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "user_id": "12345678-1234-1234-1234-123456789012",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user"
    }
  }
  ```

#### 2.1.3 获取用户信息

* **测试网址**：`http://localhost:8001/api/v1/users/profile`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "user_id": "12345678-1234-1234-1234-123456789012",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user"
    }
  }
  ```

#### 2.1.4 更新用户信息

* **测试网址**：`http://localhost:8001/api/v1/users/profile`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "name": "更新后的测试用户"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "user_id": "12345678-1234-1234-1234-123456789012",
      "email": "test@example.com",
      "name": "更新后的测试用户",
      "role": "user"
    }
  }
  ```

### 2.2 文档管理模块

#### 2.2.1 创建新文档

* **测试网址**：`http://localhost:8001/api/v1/documents`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "title": "新型冠状病毒肺炎治疗方案",
    "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
    "purpose": "临床"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "新型冠状病毒肺炎治疗方案",
      
      "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
      "purpose": "临床",
      "status": "draft",
      "created_at": "2026-02-24T13:37:00Z",
      "updated_at": "2026-02-24T13:37:00Z"
    }
  }
  ```

#### 2.2.2 获取文档列表

* **测试网址**：`http://localhost:8001/api/v1/documents?page=1&page_size=10`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "total": 1,
      "items": [
        {
          "document_id": "12345678-1234-1234-1234-123456789012",
          "title": "新型冠状病毒肺炎治疗方案",
          "status": "draft",
          "created_at": "2026-02-24T13:37:00Z",
          "updated_at": "2026-02-24T13:37:00Z"
        }
      ]
    }
  }
  ```

#### 2.2.3 获取文档详情

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "新型冠状病毒肺炎治疗方案",
      
      "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
      "purpose": "临床",
      "status": "draft",
      "created_at": "2026-02-24T13:37:00Z",
      "updated_at": "2026-02-24T13:37:00Z"
    }
  }
  ```

#### 2.2.4 更新文档信息

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "title": "更新后的新型冠状病毒肺炎治疗方案",
    "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性，包含最新研究成果",
    "purpose": "临床研究"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "更新后的新型冠状病毒肺炎治疗方案",

      "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性，包含最新研究成果",
      "purpose": "临床研究",
      "status": "draft",
      "created_at": "2026-02-24T13:37:00Z",
      "updated_at": "2026-02-24T13:37:00Z"
    }
  }
  ```

#### 2.2.5 删除文档

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}`

* **请求方法**：DELETE

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "删除成功",
    "data": null
  }
  ```

#### 2.2.6 生成方案结构

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/generate`

* **请求方法**：POST

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "message": "生成成功",
      "chapters": [
        {
          "chapter_id": "789012",
          "title": "项目核心信息",
          "status": "pending"
        },
        {
          "chapter_id": "345678",
          "title": "方案摘要",
          "status": "pending"
        },
        {
          "chapter_id": "901234",
          "title": "方案全文",
          "status": "pending"
        }
      ]
    }
  }
  ```

### 2.3 章节管理模块

#### 2.3.1 获取文档章节列表

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/chapters`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "chapters": [
        {
          "chapter_id": "12345678-1234-1234-1234-123456789012",
          "title": "研究背景与目的",
          "order_index": 1,
          "paragraphs": []
        }
      ]
    }
  }
  ```

#### 2.3.2 新增章节

* **测试网址**：`http://localhost:8001/api/v1/chapters`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "title": "研究背景与目的",
    "order_index": 1
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "chapter_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "研究背景与目的",
      "order_index": 1,
      "updated_at": "2026-02-24T13:37:00Z",
      "paragraphs": []
    }
  }
  ```

#### 2.3.3 获取章节详情

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "chapter_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "parent_id": null,
      "title": "研究背景与目的",
      "status": "editing",
      "order_index": 1,
      "updated_at": "2026-02-24T13:37:00Z",
      "paragraphs": []
    }
  }
  ```

#### 2.3.4 更新章节信息

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "title": "研究背景与目的更新",
    "order_index": 2
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "保存成功",
    "data": {
      "chapter_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "parent_id": null,
      "title": "研究背景与目的更新",
      "order_index": 2,
      "updated_at": "2026-02-24T13:37:00Z",
      "paragraphs": []
    }
  }
  ```

#### 2.3.5 删除章节

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}`

* **请求方法**：DELETE

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "删除成功",
    "data": null
  }
  ```

#### 2.3.6 获取章节操作历史

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}/history`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "history": [
        {
          "history_id": "12345678-1234-1234-1234-123456789012",
          "chapter_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "user_id": "12345678-1234-1234-1234-123456789012",
          "action": "update",
          "content_before": "研究背景与目的",
          "content_after": "研究背景与目的更新",
          "created_at": "2026-02-24T13:37:00Z"
        }
      ]
    }
  }
  ```

### 2.4 段落管理模块

#### 2.4.1 创建段落

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}/paragraphs`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "content": "研究背景与目的",
    "para_type": "heading-1",
    "order_index": 1
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "paragraph_id": "12345678-1234-1234-1234-123456789012",
      "chapter_id": "12345678-1234-1234-1234-123456789012",
      "content": "研究背景与目的",
      "para_type": "heading-1",
      "order_index": 1,
      "ai_eval": null,
      "ai_suggestion": null,
      "ai_generate": null,
      "ischange": 0
    }
  }
  ```

#### 2.4.2 更新段落

* **测试网址**：`http://localhost:8001/api/v1/paragraphs/{paragraph_id}`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "content": "研究背景与目的更新",
    "order_index": 1
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "paragraph_id": "12345678-1234-1234-1234-123456789012",
      "chapter_id": "12345678-1234-1234-1234-123456789012",
      "content": "研究背景与目的更新",
      "para_type": "heading-1",
      "order_index": 1,
      "ai_eval": null,
      "ai_suggestion": null,
      "ai_generate": null,
      "ischange": 0
    }
  }
  ```

### 2.5 摘要管理模块

#### 2.5.1 创建摘要

* **测试网址**：`http://localhost:8001/api/v1/summaries`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "title": "试验名称",
    "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验名称",
      "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验",
      "version": 1,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.5.2 获取文档的摘要列表

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/summaries`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "total": 2,
      "items": [
        {
          "summary_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "title": "试验名称",
          "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验",
          "version": 1,
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        },
        {
          "summary_id": "87654321-4321-4321-4321-210987654321",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "title": "试验目的",
          "content": "验证试验器械用于改善肩颈部或腰部疼痛的有效性和安全性。",
          "version": 1,
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

#### 2.5.3 获取摘要详情

* **测试网址**：`http://localhost:8001/api/v1/summaries/{summary_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验名称",
      "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验",
      "version": 1,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.5.4 获取文档的最新摘要

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/summaries/latest`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验名称",
      "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验",
      "version": 1,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.5.5 更新摘要

* **测试网址**：`http://localhost:8001/api/v1/summaries/{summary_id}`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "title": "试验名称更新",
    "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验（更新版）"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验名称更新",
      "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验（更新版）",
      "version": 2,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.5.6 删除摘要

* **测试网址**：`http://localhost:8001/api/v1/summaries/{summary_id}`

* **请求方法**：DELETE

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "删除成功",
    "data": null
  }
  ```

#### 2.5.7 获取段落关联的摘要信息

* **测试网址**：`http://localhost:8001/api/v1/paragraphs/{paragraph_id}/summaries`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summaries": [
        {
          "summary_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "title": "试验名称",
          "content": "评价高频治疗仪用于改善肩颈部或腰部疼痛的有效性和安全性的前瞻性、多中心、随机、盲法、安慰剂对照、优效性临床试验",
          "version": 1,
          "summary_sections": "使用的摘要部分",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

#### 2.5.8 获取摘要关联的段落信息

* **测试网址**：`http://localhost:8001/api/v1/summaries/{summary_id}/paragraphs?section_id={section_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "paragraphs": [
        {
          "paragraph_id": "12345678-1234-1234-1234-123456789012",
          "chapter_id": "12345678-1234-1234-1234-123456789012",
          "content": "段落内容",
          "para_type": "heading-1",
          "order_index": 1,
          "ai_eval": "AI评估",
          "ai_suggestion": "AI建议",
          "summary_sections": "关联的摘要部分",
          "summary_version": 1
        }
      ]
    }
  }
  ```

### 2.6 关键词管理模块

#### 2.6.1 创建关键词

* **测试网址**：`http://localhost:8001/api/v1/keywords`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "keyword": "高频治疗仪"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keyword_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "keyword": "高频治疗仪",
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.6.2 获取文档的关键词列表

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/keywords`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keywords": [
        {
          "keyword_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "keyword": "高频治疗仪",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

#### 2.6.3 获取关键词详情

* **测试网址**：`http://localhost:8001/api/v1/keywords/{keyword_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keyword_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "keyword": "高频治疗仪",
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.6.4 更新关键词

* **测试网址**：`http://localhost:8001/api/v1/keywords/{keyword_id}`

* **请求方法**：PUT

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "keyword": "高频治疗仪（更新）"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keyword_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "keyword": "高频治疗仪（更新）",
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.6.5 删除关键词

* **测试网址**：`http://localhost:8001/api/v1/keywords/{keyword_id}`

* **请求方法**：DELETE

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "删除成功",
    "data": null
  }
  ```

#### 2.6.6 获取摘要关联的关键词信息

* **测试网址**：`http://localhost:8001/api/v1/summaries/{summary_id}/keywords`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keywords": [
        {
          "keyword_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "keyword": "高频治疗仪",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

#### 2.6.7 获取段落关联的关键词信息

* **测试网址**：`http://localhost:8001/api/v1/paragraphs/{paragraph_id}/keywords`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keywords": [
        {
          "keyword_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "keyword": "高频治疗仪",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

### 2.7 AI 功能模块

#### 2.7.1 AI 帮填段落内容

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}/ai/assist`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "paragraph_id": "12345678-1234-1234-1234-123456789012",
    "summary_sections": ["c37770a6-69eb-4451-8afe-b2441aaf0a91", "9d5e11db-373f-4813-ab9a-44dabe9cb4ae"]
  }
  ```

* **响应示例**：
  流式响应，实时返回生成的内容：

  ```
  data: {"content": "肩颈疼痛是全球最普遍的肌肉骨骼疾病，已成为重大公共卫生挑战。据世界卫生组织统计，全球约有10亿人患有不同程度的肩颈疼痛，每年因肩颈疼痛导致的工作日损失超过2亿天，给社会经济带来巨大负担。肩颈疼痛不仅影响患者的生活质量，还可能导致焦虑、抑郁等心理问题。"}
  
  ...
  
  data: [DONE]
  ```

#### 2.7.2 AI 评估段落内容

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}/ai/evaluate`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "paragraph_id": "12345678-1234-1234-1234-123456789012"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "evaluation": "段落内容专业性强，逻辑清晰，准确描述了肩颈疼痛的普遍性和公共卫生影响。",
      "suggestions": [
        "建议增加具体的流行病学数据支持",
        "可以补充一些肩颈疼痛的常见原因和风险因素",
        "建议提及目前的主要治疗方法"
      ]
    }
  }
  ```

#### 2.7.3 AI 帮填摘要

* **测试网址**：`http://localhost:8001/api/v1/summaries/ai/assist`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "title": "试验目的"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验目的",
      "content": "验证试验器械用于改善肩颈部或腰部疼痛的有效性和安全性。",
      "version": 1,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.7.4 AI 帮填关键词

* **测试网址**：`http://localhost:8001/api/v1/keywords/ai/assist`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "keywords": [
        {
          "keyword_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "keyword": "高频治疗仪",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        },
        {
          "keyword_id": "87654321-4321-4321-4321-210987654321",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "keyword": "肩颈疼痛",
          "created_at": "2026-03-03T08:34:45Z",
          "updated_at": "2026-03-03T08:34:45Z"
        }
      ]
    }
  }
  ```

#### 2.7.5 AI 帮填摘要

* **测试网址**：`http://localhost:8001/api/v1/summaries/ai/assist`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "title": "试验目的"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "summary_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "title": "试验目的",
      "content": "验证试验器械用于改善肩颈部或腰部疼痛的有效性和安全性。",
      "version": 1,
      "created_at": "2026-03-03T08:34:45Z",
      "updated_at": "2026-03-03T08:34:45Z"
    }
  }
  ```

#### 2.7.6 与 AI 助理对话

* **测试网址**：`http://localhost:8001/api/v1/ai/chat`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "message": "请帮我解释一下这个方案的主要内容",
    "document_id": "12345678-1234-1234-1234-123456789012",
    "current_chapter_id": "12345678-1234-1234-1234-123456789012"
  }
  ```

* **响应示例**：
  流式响应，实时返回AI回复内容：

  ```
  data: {"response": "您好！根据您的方案，这是一个关于高频治疗仪用于改善肩颈部或腰部疼痛的临床试验方案。方案主要包括研究背景、研究目的、研究方法、数据收集与分析等章节。"}
  
  ...
  
  data: [DONE]
  ```

#### 2.7.6 AI 修订模式

* **测试网址**：`http://localhost:8001/api/v1/ai/revision`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "document_id": "12345678-1234-1234-1234-123456789012",
    "chapter_id": "12345678-1234-1234-1234-123456789012",
    "instruction": "请将这段内容修改得更加专业和简洁"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "content": [
        {
          "type": "paragraph",
          "content": "修改后的专业内容"
        }
      ],
      "message": "修订成功"
    }
  }
  ```

### 2.8 辅助功能模块

#### 2.8.1 获取章节内容目录

* **测试网址**：`http://localhost:8001/api/v1/chapters/{chapter_id}/toc`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "toc": [
        {
          "id": "12345678-1234-1234-1234-123456789012",
          "type": "heading-1",
          "content": "研究背景与目的",
          "order_index": 1
        },
        {
          "id": "87654321-4321-4321-4321-210987654321",
          "type": "heading-2",
          "content": "研究背景",
          "order_index": 2
        }
      ]
    }
  }
  ```

#### 2.8.2 从摘要生成正文章节

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/chapters/generate`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "summary_id": "12345678-1234-1234-1234-123456789012"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "chapters": [
        {
          "chapter_id": "12345678-1234-1234-1234-123456789012",
          "title": "研究背景",
          "order_index": 1
        },
        {
          "chapter_id": "87654321-4321-4321-4321-210987654321",
          "title": "研究目的",
          "order_index": 2
        }
      ]
    }
  }
  ```

#### 2.8.3 获取生成方案元数据

* **测试网址**：`http://localhost:8001/api/v1/metadata/generate`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "generateType": "clinical",
      "title": "临床试验方案",
      "fields": [
        {
          "name": "title",
          "label": "方案标题",
          "type": "string",
          "required": true
        },
        {
          "name": "keywords",
          "label": "研究关键词",
          "type": "array",
          "required": true
        }
      ]
    }
  }
  ```

#### 2.8.4 获取使用教程

* **测试网址**：`http://localhost:8001/api/v1/tutorial`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "content": "使用教程内容..."
    }
  }
  ```

#### 2.8.5 获取操作历史记录

* **测试网址**：`http://localhost:8001/api/v1/history?page=1&page_size=10`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "total": 1,
      "items": [
        {
          "history_id": "12345678-1234-1234-1234-123456789012",
          "chapter_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "user_id": "12345678-1234-1234-1234-123456789012",
          "action": "update",
          "content_before": "研究背景与目的",
          "content_after": "研究背景与目的更新",
          "created_at": "2026-02-24T13:37:00Z"
        }
      ]
    }
  }
  ```

#### 2.8.6 获取文档快照列表

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/snapshots`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "snapshots": [
        {
          "version_id": "12345678-1234-1234-1234-123456789012",
          "document_id": "12345678-1234-1234-1234-123456789012",
          "description": "快照1",
          "snapshot_data": {},
          "created_at": "2026-02-24T13:37:00Z",
          "created_by": "12345678-1234-1234-1234-123456789012"
        }
      ]
    }
  }
  ```

#### 2.8.7 获取快照详情

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/snapshots/detail/{snapshot_id}`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "version_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "description": "快照1",
      "snapshot_data": {},
      "created_at": "2026-02-24T13:37:00Z",
      "created_by": "12345678-1234-1234-1234-123456789012"
    }
  }
  ```

#### 2.8.8 获取默认快照描述

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/snapshots-meta/default-description`

* **请求方法**：GET

* **请求头**：

  * Authorization: Bearer {token}

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "default_description": "快照X"
    }
  }
  ```

#### 2.8.9 创建文档快照

* **测试网址**：`http://localhost:8001/api/v1/documents/{document_id}/snapshots`

* **请求方法**：POST

* **请求头**：

  * Content-Type: application/json

  * Authorization: Bearer {token}

* **请求体**：

  ```json
  {
    "description": "快照描述"
  }
  ```

* **响应示例**：

  ```json
  {
    "code": 200,
    "message": "成功",
    "data": {
      "version_id": "12345678-1234-1234-1234-123456789012",
      "document_id": "12345678-1234-1234-1234-123456789012",
      "description": "快照描述",
      "snapshot_data": {},
      "created_at": "2026-02-24T13:37:00Z",
      "created_by": "12345678-1234-1234-1234-123456789012"
    }
  }
  ```

## 3. 测试注意事项

1. **认证**：部分接口需要 JWT 认证令牌，请在请求头中添加 `Authorization: Bearer {token}`
2. **路径参数**：请将 `{document_id}`、`{chapter_id}`、`{paragraph_id}` 等路径参数替换为实际的 ID
3. **请求体格式**：所有请求体均为 JSON 格式，请确保 `Content-Type: application/json`
4. **AI 接口**：AI 帮填接口为流式响应，返回的是事件流格式
5. **错误处理**：如果遇到错误，请检查请求参数是否正确，以及是否有足够的权限

## 4. 常见问题

1. **401 未授权**：请检查是否提供了有效的 JWT 令牌
2. **404 资源不存在**：请检查路径参数是否正确，以及资源是否存在
3. **422 验证错误**：请检查请求体是否符合要求的格式
4. **500 服务器错误**：请检查服务器日志，或联系管理员

## 5. 测试工具

推荐使用以下工具进行接口测试：

1. **Apifox**：功能强大的 API 测试工具，支持团队协作
2. **Postman**：流行的 API 测试工具
3. **curl**：命令行工具，适合简单测试
4. **HTTPie**：现代化的命令行 HTTP 客户端

## 6. 测试用例

### 6.1 功能测试

| 测试用例    | 预期结果            |
| ------- | --------------- |
| 用户注册    | 成功创建用户并返回用户信息   |
| 用户登录    | 成功登录并返回 JWT 令牌  |
| 创建文档    | 成功创建文档并返回文档信息   |
| 获取文档列表  | 成功返回文档列表        |
| 创建章节    | 成功创建章节并返回章节信息   |
| 创建段落    | 成功创建段落并返回段落信息   |
| 创建摘要    | 成功创建摘要并返回摘要信息   |
| 创建关键词   | 成功创建关键词并返回关键词信息 |
| AI 帮填段落 | 成功生成内容并流式返回     |
| AI 评估段落 | 成功评估并返回评估结果和建议  |
| 从摘要生成章节 | 成功生成章节并返回章节列表   |

### 6.2 边界测试

| 测试用例         | 预期结果         |
| ------------ | ------------ |
| 空文档标题        | 返回 422 验证错误  |
| 超过长度限制的文档标题  | 返回 422 验证错误  |
| 无效的文档 ID     | 返回 404 资源不存在 |
| 未授权访问需要认证的接口 | 返回 401 未授权   |

### 6.3 异常测试

| 测试用例     | 预期结果         |
| -------- | ------------ |
| 数据库连接失败  | 返回 500 服务器错误 |
| AI 服务不可用 | 返回 500 服务器错误 |
| 网络超时     | 返回 500 服务器错误 |

## 7. 测试环境配置

### 7.1 本地开发环境

* **服务器地址**：`http://localhost:8001`

* **数据库地址**：`postgresql://username:password@localhost:5432/database`

* **环境变量**：

  * `DATABASE_URL`：数据库连接字符串

  * `SECRET_KEY`：JWT 签名密钥

  * `ALGORITHM`：JWT 算法

  * `ACCESS_TOKEN_EXPIRE_MINUTES`：访问令牌过期时间

### 7.2 测试环境

* **服务器地址**：`http://test-server:8001`

* **数据库地址**：`postgresql://test:test@test-db:5432/test-database`

### 7.3 生产环境

* **服务器地址**：`http://api.example.com`

* **数据库地址**：`postgresql://prod:prod@prod-db:5432/prod-database`

## 8. 测试报告

| 接口      | 测试结果 | 备注          |
| ------- | ---- | ----------- |
| 用户登录    | 通过   | 正常返回 JWT 令牌 |
| 用户注册    | 通过   | 正常创建用户      |
| 创建文档    | 通过   | 正常创建文档      |
| 获取文档列表  | 通过   | 正常返回文档列表    |
| 创建章节    | 通过   | 正常创建章节      |
| 创建段落    | 通过   | 正常创建段落      |
| 创建摘要    | 通过   | 正常创建摘要      |
| 创建关键词   | 通过   | 正常创建关键词     |
| AI 帮填段落 | 通过   | 正常流式返回生成内容  |
| AI 评估段落 | 通过   | 正常返回评估结果    |
| 从摘要生成章节 | 通过   | 正常生成章节      |

## 9. 结论

本测试文档覆盖了方案生成系统的主要接口，包括用户管理、文档管理、章节管理、段落管理、摘要管理、关键词管理、AI 功能和辅助功能。所有接口均已测试通过，系统运行正常。

通过 Apifox 等测试工具，可以方便地进行接口测试和调试，确保系统的稳定性和可靠性。
