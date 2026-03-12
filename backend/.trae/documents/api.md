# 方案生成系统接口文档

## 1. 接口概述

本接口文档描述了方案生成系统的 RESTful API 设计，基于 FastAPI 框架实现。系统接口分为用户管理、文档管理、章节管理、段落管理、AI 功能和辅助功能六大模块，提供完整的方案生成、编辑和协作功能。

## 2. 接口规范

### 2.1 基础路径

所有接口的基础路径为 `/api/v1`。

### 2.2 响应格式

系统统一采用 JSON 格式响应，标准响应结构如下：

```json
{
  "code": 200,
  "message": "成功",
  "data": {}
}
```

### 2.3 错误处理

系统使用 HTTP 状态码表示错误类型，常见错误码如下：

| 状态码 | 描述      |
| --- | ------- |
| 400 | 请求参数错误  |
| 401 | 未授权访问   |
| 403 | 禁止访问    |
| 404 | 资源不存在   |
| 500 | 服务器内部错误 |

### 2.4 数据传输对象（DTO/VO）

系统使用 Pydantic 模型定义数据传输对象，确保数据的类型安全和验证。主要的 DTO/VO 包括：

#### 2.4.1 用户相关

* `UserCreate`：用户注册请求

* `UserLogin`：用户登录请求

* `UserUpdate`：用户信息更新请求

* `User`：用户信息响应

* `Token`：登录令牌响应

#### 2.4.2 文档相关

* `DocumentCreate`：文档创建请求

* `DocumentUpdate`：文档更新请求

* `Document`：文档信息响应

* `DocumentList`：文档列表响应

* `MetadataConfig`：元数据配置响应

* `ChapterCreate`：章节创建请求（包含title字段）

* `ChapterUpdate`：章节更新请求（支持更新标题和排序索引）

* `Chapter`：章节信息响应（包含title字段和paragraphs字段）

* `ChapterList`：章节列表响应

* `ParagraphCreate`：段落创建请求（包含ai\_generate和ischange字段）

* `ParagraphUpdate`：段落更新请求（包含ai\_generate和ischange字段）

* `Paragraph`：段落信息响应（包含ai\_generate和ischange字段）

* `DocumentVersionCreate`：文档版本创建请求

* `DocumentVersion`：文档版本响应

* `DocumentVersionList`：文档版本列表响应

* `OperationHistory`：操作历史响应

* `OperationHistoryList`：操作历史列表响应

* `ChapterHistoryList`：章节操作历史列表响应

#### 2.4.3 AI 功能相关

* `AIAssistResponse`：AI 帮填响应

* `AIEvaluateResponse`：AI 评估响应

* `AIChatRequest`：AI 聊天请求

* `AIChatResponse`：AI 聊天响应

* `AIRevisionRequest`：AI 修订请求

* `AIRevisionResponse`：AI 修订响应

#### 2.4.4 摘要相关

* `DocumentSummaryCreate`：摘要创建请求（content为纯文本，包含order\_index字段）

* `DocumentSummaryUpdate`：摘要更新请求（content为纯文本）

* `DocumentSummary`：摘要信息响应（content为纯文本，包含order\_index字段）

* `DocumentSummaryList`：摘要列表响应

* `ParagraphSummaryLink`：摘要-段落关联响应

* `AIAssistRequest`：AI 帮填请求（支持选择摘要部分）

#### 2.4.5 关键词相关

* `DocumentKeywordCreate`：关键词创建请求

* `DocumentKeywordUpdate`：关键词更新请求

* `DocumentKeyword`：关键词信息响应

* `DocumentKeywordList`：关键词列表响应

* `KeywordSummaryLink`：关键词-摘要关联响应

* `KeywordParagraphLink`：关键词-段落关联响应

#### 2.4.6 AI 功能相关

* `AIAssistRequest`：AI 帮填请求（支持选择摘要部分）

* `AIEvaluateRequest`：AI 评估请求（只需要段落ID）

#### 2.4.57 辅助功能相关

* `TutorialResponse`：使用教程响应

* `GenerateSchemaResponse`：生成方案结构响应

## 3. 接口详情

### 3.1 用户管理模块

| 接口路径                     | 方法   | 功能描述   | 请求参数                                                                | 响应数据                                                                            |
| ------------------------ | ---- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/api/v1/users/login`    | POST | 用户登录   | `UserLogin` 模型- email: EmailStr 邮箱- password: str 密码                | `Token` 模型- access\_token: str 访问令牌- token\_type: str 令牌类型- user\_id: str 用户 ID |
| `/api/v1/users/register` | POST | 用户注册   | `UserCreate` 模型- email: EmailStr 邮箱- password: str 密码- name: str 姓名 | `User` 模型- user\_id: str 用户 ID- email: str 邮箱- name: str 姓名- role: str 用户角色     |
| `/api/v1/users/profile`  | GET  | 获取用户信息 | 无（从 token 中获取用户 ID）                                                 | `User` 模型- user\_id: str 用户 ID- email: str 邮箱- name: str 姓名- role: str 用户角色     |
| `/api/v1/users/profile`  | PUT  | 更新用户信息 | `UserUpdate` 模型- name: Optional\[str] 姓名                            | `User` 模型- user\_id: str 用户 ID- email: str 邮箱- name: str 姓名- role: str 用户角色     |

### 3.2 文档管理模块

| 接口路径                                       | 方法     | 功能描述   | 请求参数                                                                                                                                                                                                                 | 响应数据                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/documents`                        | POST   | 创建新文档  | `DocumentCreate` 模型- title: str 方案标题（最大 80 字）- keywords: List\[str] 研究关键词- abstract: Optional\[str] 正文摘要- content: Optional\[List\[Dict]] 参考正文（Block Schema格式）- purpose: Optional\[str] 使用目的- template_id: Optional\[str] 模板 ID                         | `Document` 模型- document\_id: str 文档 ID- user\_id: str 用户 ID- template\_id: Optional\[str] 模板 ID- title: str 方案标题- keywords: List\[str] 研究关键词- abstract: Optional\[str] 正文摘要- content: Optional\[List\[Dict]] 参考正文（Block Schema格式）- purpose: Optional\[str] 使用目的- status: str 文档状态- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/documents`                        | GET    | 获取文档列表 | `page: int` 页码`page_size: int` 每页数量                                                                                                                                                                                  | `DocumentList` 模型- total: int 总数量- items: List\[Document] 文档列表                                                                                                                                                                                                                                        |
| `/api/v1/documents/{document_id}`          | GET    | 获取文档详情 | `document_id: str` 文档 ID                                                                                                                                                                                             | `Document` 模型- document\_id: str 文档 ID- user\_id: str 用户 ID- template\_id: Optional\[str] 模板 ID- title: str 方案标题- keywords: List\[str] 研究关键词- abstract: Optional\[str] 正文摘要- content: Optional\[List\[Dict]] 参考正文（Block Schema格式）- purpose: Optional\[str] 使用目的- status: str 文档状态- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/documents/{document_id}`          | PUT    | 更新文档信息 | `document_id: str` 文档 ID`DocumentUpdate` 模型- title: str 方案标题（最大 80 字）- keywords: List\[str] 研究关键词- abstract: Optional\[str] 正文摘要- content: Optional\[List\[Dict]] 参考正文（Block Schema格式）- purpose: Optional\[str] 使用目的- template_id: Optional\[str] 模板 ID | `Document` 模型- document\_id: str 文档 ID- user\_id: str 用户 ID- template\_id: Optional\[str] 模板 ID- title: str 方案标题- keywords: List\[str] 研究关键词- abstract: Optional\[str] 正文摘要- content: Optional\[List\[Dict]] 参考正文（Block Schema格式）- purpose: Optional\[str] 使用目的- status: str 文档状态- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/documents/{document_id}`          | DELETE | 删除文档   | `document_id: str` 文档 ID                                                                                                                                                                                             | `{"message": "删除成功"}`                                                                                                                                                                                                                                                                                 |
| `/api/v1/documents/{document_id}/generate` | POST   | 生成方案结构 | `document_id: str` 文档 ID                                                                                                                                                                                             | `GenerateSchemaResponse` 模型- message: str 响应消息- chapters: List\[dict] 生成的章节列表（使用 AI 根据文档信息生成）                                                                                                                                                                                                         |

### 3.3 章节管理模块

| 接口路径                                       | 方法     | 功能描述     | 请求参数                                                                                                                                                 | 响应数据                                                                                                                                                                                                                       |
| ------------------------------------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/documents/{document_id}/chapters` | GET    | 获取文档章节列表 | `document_id: str` 文档 ID                                                                                                                             | `ChapterList` 模型- chapters: List\[Chapter] 章节列表（包含段落信息）                                                                                                                                                                    |
| `/api/v1/chapters`                         | POST   | 新增章节     | `ChapterCreate` 模型- document\_id: str 文档 ID- title: str 章节标题- parent\_id: Optional\[str] 父章节 ID- status: Optional\[str] 章节状态- order\_index: int 排序索引 | `Chapter` 模型- chapter\_id: str 章节 ID- document\_id: str 文档 ID- parent\_id: Optional\[str] 父章节 ID- title: str 章节标题- status: str 章节状态- order\_index: int 排序索引- updated\_at: datetime 更新时间- paragraphs: List\[Paragraph] 段落列表 |
| `/api/v1/chapters/{chapter_id}`            | GET    | 获取章节详情   | `chapter_id: str` 章节 ID                                                                                                                              | `Chapter` 模型- chapter\_id: str 章节 ID- document\_id: str 文档 ID- parent\_id: Optional\[str] 父章节 ID- title: str 章节标题- status: str 章节状态- order\_index: int 排序索引- updated\_at: datetime 更新时间- paragraphs: List\[Paragraph] 段落列表 |
| `/api/v1/chapters/{chapter_id}`            | PUT    | 更新章节信息   | `chapter_id: str` 章节 ID`ChapterUpdate` 模型- title: Optional\[str] 章节标题- status: Optional\[str] 章节状态- order\_index: Optional\[int] 排序索引                | `Chapter` 模型- chapter\_id: str 章节 ID- document\_id: str 文档 ID- parent\_id: Optional\[str] 父章节 ID- title: str 章节标题- status: str 章节状态- order\_index: int 排序索引- updated\_at: datetime 更新时间- paragraphs: List\[Paragraph] 段落列表 |
| `/api/v1/chapters/{chapter_id}`            | DELETE | 删除章节     | `chapter_id: str` 章节 ID                                                                                                                              | `{"message": "删除成功"}`                                                                                                                                                                                                      |
| `/api/v1/chapters/{chapter_id}/history`    | GET    | 获取章节操作历史 | `chapter_id: str` 章节 ID                                                                                                                              | `ChapterHistoryList` 模型- history: List\[OperationHistory] 操作历史列表                                                                                                                                                           |
| `/api/v1/documents/{document_id}/chapters/generate` | POST   | 从摘要生成正文章节 | `document_id: str` 文档 ID                                                                                                                             | `{"chapters": [{"chapter_id": "章节ID", "title": "章节标题", "order_index": 1}]}` 从摘要生成的章节列表                                                                                                                                     |
| `/api/v1/chapters/batch`                            | POST   | 批量创建章节    | `BatchChapterCreate` 模型- chapters: List\[ChapterCreate] 章节列表                                                                                         | `{"chapters": [{"chapter_id": "章节ID", "document_id": "文档ID", "title": "章节标题", "order_index": 1, "updated_at": "更新时间"}]}`                                                                                                   |

### 3.4 摘要管理模块

| 接口路径                                               | 方法     | 功能描述        | 请求参数                                                                                                                                                         | 响应数据                                                                                                                                                                                                             |
| -------------------------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/summaries`                                | POST   | 创建摘要        | `DocumentSummaryCreate` 模型- document\_id: str 文档 ID- title: str 摘要标题- content: str 摘要内容（纯文本）- order\_index: Optional\[int] 排序索引                              | `DocumentSummary` 模型- summary\_id: str 摘要 ID- document\_id: str 文档 ID- title: str 摘要标题- content: str 摘要内容（纯文本）- version: int 版本号- order\_index: int 排序索引- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/summaries/{summary_id}`                   | GET    | 获取摘要详情      | `summary_id: str` 摘要 ID                                                                                                                                      | `DocumentSummary` 模型- summary\_id: str 摘要 ID- document\_id: str 文档 ID- title: str 摘要标题- content: str 摘要内容（纯文本）- version: int 版本号- created\_at: datetime 创建时间- updated\_at: datetime 更新时间                         |
| `/api/v1/documents/{document_id}/summaries`        | GET    | 获取文档的摘要列表   | `document_id: str` 文档 ID                                                                                                                                     | `DocumentSummaryList` 模型- total: int 总数量- items: List\[DocumentSummary] 摘要列表（content为纯文本）                                                                                                                        |
| `/api/v1/documents/{document_id}/summaries/latest` | GET    | 获取文档的最新摘要   | `document_id: str` 文档 ID                                                                                                                                     | `DocumentSummary` 模型- summary\_id: str 摘要 ID- document\_id: str 文档 ID- title: str 摘要标题- content: str 摘要内容（纯文本）- version: int 版本号- created\_at: datetime 创建时间- updated\_at: datetime 更新时间                         |
| `/api/v1/summaries/{summary_id}`                   | PUT    | 更新摘要        | `summary_id: str` 摘要 ID`DocumentSummaryUpdate` 模型- title: Optional\[str] 摘要标题- content: Optional\[str] 摘要内容（纯文本）                                             | `DocumentSummary` 模型- summary\_id: str 摘要 ID- document\_id: str 文档 ID- title: str 摘要标题- content: str 摘要内容（纯文本）- version: int 版本号- created\_at: datetime 创建时间- updated\_at: datetime 更新时间                         |
| `/api/v1/summaries/{summary_id}`                   | DELETE | 删除摘要        | `summary_id: str` 摘要 ID                                                                                                                                      | `{"message": "删除成功"}`                                                                                                                                                                                            |
| `/api/v1/paragraphs/{paragraph_id}/summaries`      | GET    | 获取段落关联的摘要信息 | `paragraph_id: str` 段落 ID                                                                                                                                    | `{"summaries": [{"summary_id": "摘要ID", "document_id": "文档ID", "title": "摘要标题", "content": "摘要内容", "version": 1, "summary_sections": "使用的摘要部分", "created_at": "创建时间", "updated_at": "更新时间"}]}`                    |
| `/api/v1/summaries/ai/assist`                      | POST   | AI 帮填摘要     | `AIAssistSummaryRequest` 模型- document\_id: str 文档 ID- summary\_ids: Optional\[List\[str]] 摘要 ID列表（为空时一键生成所有摘要）- keywords: Optional\[List\[str]] 关键词 ID列表（可选） | `{"summaries": [{"summary_id": "摘要ID", "document_id": "文档ID", "title": "摘要标题", "content": "摘要内容", "version": 1, "order_index": 0, "created_at": "创建时间", "updated_at": "更新时间"}]}`                                 |
| `/api/v1/summaries/batch`                          | POST   | 批量创建摘要      | `BatchSummaryCreate` 模型- summaries: List\[DocumentSummaryCreate] 摘要列表                                                                                        | `{"summaries": [{"summary_id": "摘要ID", "document_id": "文档ID", "title": "摘要标题", "content": "摘要内容", "version": 1, "order_index": 0, "created_at": "创建时间", "updated_at": "更新时间"}]}`                                 |

### 3.5 关键词管理模块

| 接口路径                                         | 方法     | 功能描述         | 请求参数                                                                  | 响应数据                                                                                                                                     |
| -------------------------------------------- | ------ | ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/keywords`                           | POST   | 创建关键词        | `DocumentKeywordCreate` 模型- documentid: str 文档 ID- keyword: str 关键词   | `DocumentKeyword` 模型- keywordid: str 关键词 ID- documentid: str 文档 ID- keyword: str 关键词- createdat: datetime 创建时间- updatedat: datetime 更新时间 |
| `/api/v1/keywords/{keyword_id}`              | GET    | 获取关键词详情      | `keyword_id: str` 关键词 ID                                              | `DocumentKeyword` 模型- keywordid: str 关键词 ID- documentid: str 文档 ID- keyword: str 关键词- createdat: datetime 创建时间- updatedat: datetime 更新时间 |
| `/api/v1/documents/{document_id}/keywords`   | GET    | 获取文档的关键词列表   | `document_id: str` 文档 ID                                              | `{"keywords": [{"keyword_id": "关键词ID", "document_id": "文档ID", "keyword": "关键词", "created_at": "创建时间", "updated_at": "更新时间"}]}`           |
| `/api/v1/keywords/{keyword_id}`              | PUT    | 更新关键词        | `keyword_id: str` 关键词 ID`DocumentKeywordUpdate` 模型- keyword: str 关键词  | `DocumentKeyword` 模型- keywordid: str 关键词 ID- documentid: str 文档 ID- keyword: str 关键词- createdat: datetime 创建时间- updatedat: datetime 更新时间 |
| `/api/v1/keywords/{keyword_id}`              | DELETE | 删除关键词        | `keyword_id: str` 关键词 ID                                              | `{"message": "删除成功"}`                                                                                                                    |
| `/api/v1/summaries/{summary_id}/keywords`    | GET    | 获取摘要关联的关键词信息 | `summary_id: str` 摘要 ID                                               | `{"keywords": [{"keyword_id": "关键词ID", "document_id": "文档ID", "keyword": "关键词", "created_at": "创建时间", "updated_at": "更新时间"}]}`           |
| `/api/v1/paragraphs/{paragraph_id}/keywords` | GET    | 获取段落关联的关键词信息 | `paragraph_id: str` 段落 ID                                             | `{"keywords": [{"keyword_id": "关键词ID", "document_id": "文档ID", "keyword": "关键词", "created_at": "创建时间", "updated_at": "更新时间"}]}`           |
| `/api/v1/keywords/ai/assist`                 | POST   | AI 帮填关键词     | `document_id: str` 文档 ID                                              | `{"keywords": [{"keyword_id": "关键词ID", "document_id": "文档ID", "keyword": "关键词", "created_at": "创建时间", "updated_at": "更新时间"}]}`           |
| `/api/v1/keywords/batch`                     | POST   | 批量创建关键词      | `BatchKeywordCreate` 模型- keywords: List\[DocumentKeywordCreate] 关键词列表 | `{"keywords": [{"keyword_id": "关键词ID", "document_id": "文档ID", "keyword": "关键词", "created_at": "创建时间", "updated_at": "更新时间"}]}`           |

### 3.46 段落管理模块

| 接口路径                                             | 方法     | 功能描述   | 请求参数                                                                                                                                                                                                                                                                                      | 响应数据                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/chapters/{chapter_id}/paragraphs`       | POST   | 创建段落   | `chapter_id: str` 章节 ID`ParagraphCreate` 模型- content: str 文本内容- para\_type: str 类型- order\_index: int 排序索引- ai\_eval: Optional\[str] AI评估- ai\_suggestion: Optional\[str] AI建议- ai\_generate: Optional\[str] AI生成内容- ischange: int 关联摘要变更状态                                               | `Paragraph` 模型- paragraph\_id: str 段落 ID- chapter\_id: str 章节 ID- content: str 文本内容- para\_type: str 类型- order\_index: int 排序索引- ai\_eval: Optional\[str] AI评估- ai\_suggestion: Optional\[str] AI建议- ai\_generate: Optional\[str] AI生成内容- ischange: int 关联摘要变更状态 |
| `/api/v1/paragraphs/{paragraph_id}`              | GET    | 获取段落详情 | `paragraph_id: str` 段落 ID                                                                                                                                                                                                                                                                 | `Paragraph` 模型- paragraph\_id: str 段落 ID- chapter\_id: str 章节 ID- content: str 文本内容- para\_type: str 类型- order\_index: int 排序索引- ai\_eval: Optional\[str] AI评估- ai\_suggestion: Optional\[str] AI建议- ai\_generate: Optional\[str] AI生成内容- ischange: int 关联摘要变更状态 |
| `/api/v1/paragraphs/{paragraph_id}`              | PUT    | 更新段落   | `paragraph_id: str` 段落 ID`ParagraphUpdate` 模型- content: Optional\[str] 文本内容- para\_type: Optional\[str] 类型- order\_index: Optional\[int] 排序索引- ai\_eval: Optional\[str] AI评估- ai\_suggestion: Optional\[str] AI建议- ai\_generate: Optional\[str] AI生成内容- ischange: Optional\[int] 关联摘要变更状态 | `Paragraph` 模型- paragraph\_id: str 段落 ID- chapter\_id: str 章节 ID- content: str 文本内容- para\_type: str 类型- order\_index: int 排序索引- ai\_eval: Optional\[str] AI评估- ai\_suggestion: Optional\[str] AI建议- ai\_generate: Optional\[str] AI生成内容- ischange: int 关联摘要变更状态 |
| `/api/v1/paragraphs/{paragraph_id}`              | DELETE | 删除段落   | `paragraph_id: str` 段落 ID                                                                                                                                                                                                                                                                 | `{"message": "删除成功"}`                                                                                                                                                                                                                                            |
| `/api/v1/chapters/{chapter_id}/paragraphs/batch` | POST   | 批量创建段落 | `chapter_id: str` 章节 ID`BatchParagraphCreate` 模型- chapter\_id: str 章节 ID- paragraphs: List\[ParagraphCreate] 段落列表                                                                                                                                                                         | `{"paragraphs": [{"paragraph_id": "段落ID", "chapter_id": "章节ID", "content": "段落内容", "para_type": "段落类型", "order_index": 1, "ai_eval": "AI评估", "ai_suggestion": "AI建议", "ai_generate": "AI生成内容", "ischange": 0}]}`                                                 |

### 3.57 AI 功能模块

| 接口路径                                        | 方法   | 功能描述      | 请求参数                                                                                                             | 响应数据                                                                                                            |
| ------------------------------------------- | ---- | --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/api/v1/chapters/{chapter_id}/ai/assist`   | POST | AI 帮填段落内容 | `chapter_id: str` 章节 ID`AIAssistRequest` 模型- paragraph\_id: str 段落 ID- summary\_sections: List\[str] 选择的摘要部分ID列表 | 流式响应- data: {"content": "生成的内容"}（基于文档标题、关键词、章节标题、层级标题、摘要信息和当前段落内容生成，生成的内容存储在ai\_generate字段中）                    |
| `/api/v1/chapters/{chapter_id}/ai/evaluate` | POST | AI 评估段落内容 | `chapter_id: str` 章节 ID`AIAssistRequest` 模型- paragraph\_id: str 段落 ID- summary\_sections: List\[str] 选择的摘要部分ID列表 | `AIEvaluateResponse` 模型- evaluation: str 评估结果- suggestions: List\[str] 改进建议（基于文档标题、关键词、章节标题、层级标题、摘要信息和当前段落内容评估） |
| `/api/v1/ai/chat`                           | POST | 与 AI 助理对话 | `AIChatRequest` 模型- message: str 用户消息- document\_id: str 文档 ID- current\_chapter\_id: Optional\[str] 当前章节 ID     | 流式响应- data: {"response": "AI 回复内容"}                                                                             |
| `/api/v1/ai/revision`                       | POST | AI 修订模式   | `AIRevisionRequest` 模型- document\_id: str 文档 ID- chapter\_id: str 章节 ID- instruction: str 修订指令                   | `AIRevisionResponse` 模型- content: List\[Dict] 修订后的内容（Block Schema格式）- message: str 响应消息                         |

### 3.68 辅助功能模块

| 接口路径                                                                 | 方法   | 功能描述      | 请求参数                                                                      | 响应数据                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---- | --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/metadata/generate`                                          | GET  | 获取生成方案元数据 | 无                                                                         | `MetadataConfig` 模型- generateType: str 生成类型- title: str 标题- fields: List\[FieldConfig] 字段配置                                                                                   |
| `/api/v1/tutorial`                                                   | GET  | 获取使用教程    | 无                                                                         | `TutorialResponse` 模型- content: str 教程内容                                                                                                                                      |
| `/api/v1/history`                                                    | GET  | 获取操作历史记录  | `page: int` 页码`page_size: int` 每页数量                                       | `OperationHistoryList` 模型- total: int 总数量- items: List\[OperationHistory] 操作历史列表                                                                                              |
| `/api/v1/documents/{document_id}/snapshots`                          | GET  | 获取文档快照列表  | `document_id: str` 文档 ID                                                  | `DocumentVersionList` 模型- snapshots: List\[DocumentVersion] 文档版本列表                                                                                                            |
| `/api/v1/documents/{document_id}/snapshots/detail/{snapshot_id}`     | GET  | 获取快照详情    | `document_id: str` 文档 ID`snapshot_id: str` 快照 ID                          | `DocumentVersion` 模型- version\_id: str 版本 ID- document\_id: str 文档 ID- description: str 版本描述- snapshot\_data: dict 快照数据- created\_at: datetime 创建时间- created\_by: str 创建用户 ID |
| `/api/v1/documents/{document_id}/snapshots-meta/default-description` | GET  | 获取默认快照描述  | `document_id: str` 文档 ID                                                  | `{"default_description": "快照X"}` 生成的默认快照描述                                                                                                                                    |
| `/api/v1/documents/{document_id}/snapshots`                          | POST | 创建文档快照    | `document_id: str` 文档 ID`DocumentVersionCreate` 模型- description: str 版本描述 | `DocumentVersion` 模型- version\_id: str 版本 ID- document\_id: str 文档 ID- description: str 版本描述- snapshot\_data: dict 快照数据- created\_at: datetime 创建时间- created\_by: str 创建用户 ID |

### 3.69 模板管理模块

| 接口路径                                   | 方法     | 功能描述      | 请求参数                                                                                             | 响应数据                                                                                                                                      |
| -------------------------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/templates`                    | POST   | 创建模板      | `purpose: str` 用途大类`display_name: str` 具体模板名`content: dict` 模板内容`is_system: bool` 是否为系统模板`user_id: Optional[UUID]` 所属用户 | 模板对象- template\_id: str 模板 ID- group\_id: str 逻辑分组 ID- purpose: str 用途- display\_name: str 模板名- content: dict 模板内容- version: int 版本- is\_system: bool 是否系统模板- user\_id: str 所属用户- is\_active: bool 是否生效- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/templates/{template_id}`      | GET    | 获取模板详情    | `template_id: str` 模板 ID                                                                           | 模板对象- template\_id: str 模板 ID- group\_id: str 逻辑分组 ID- purpose: str 用途- display\_name: str 模板名- content: dict 模板内容- version: int 版本- is\_system: bool 是否系统模板- user\_id: str 所属用户- is\_active: bool 是否生效- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/templates`                    | GET    | 获取模板列表    | `purpose: Optional[str]` 用途筛选`is_system: Optional[bool]` 是否系统模板筛选`is_active: Optional[bool]` 是否生效筛选 | `{"items": [模板对象列表]}`                                                                                                                     |
| `/api/v1/templates/{template_id}`      | PUT    | 更新模板      | `template_id: str` 模板 ID`purpose: Optional[str]` 用途`display_name: Optional[str]` 模板名`content: Optional[dict]` 模板内容`is_system: Optional[bool]` 是否系统模板`user_id: Optional[UUID]` 所属用户`is_active: Optional[bool]` 是否生效 | 模板对象- template\_id: str 模板 ID- group\_id: str 逻辑分组 ID- purpose: str 用途- display\_name: str 模板名- content: dict 模板内容- version: int 版本- is\_system: bool 是否系统模板- user\_id: str 所属用户- is\_active: bool 是否生效- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |
| `/api/v1/templates/{template_id}`      | DELETE | 删除模板      | `template_id: str` 模板 ID                                                                           | `{"message": "删除成功"}`                                                                                                                     |
| `/api/v1/templates/purposes/list`      | GET    | 获取所有用途    | `is_system: bool` 是否系统模板（默认True）                                                              | `{"purposes": ["用途1", "用途2"]}`                                                                                                           |
| `/api/v1/templates/by-purpose/{purpose}` | GET    | 根据用途获取模板  | `purpose: str` 用途`is_system: bool` 是否系统模板（默认True）`is_active: bool` 是否生效（默认True）                       | `{"items": [模板对象列表]}`                                                                                                                     |
| `/api/v1/templates/clone/{template_id}` | POST   | 克隆模板（创建私有副本） | `template_id: str` 模板 ID`user_id: UUID` 用户 ID                                                       | 模板对象- template\_id: str 模板 ID- group\_id: str 逻辑分组 ID- purpose: str 用途- display\_name: str 模板名- content: dict 模板内容- version: int 版本- is\_system: bool 是否系统模板- user\_id: str 所属用户- is\_active: bool 是否生效- created\_at: datetime 创建时间- updated\_at: datetime 更新时间 |

## 4. 认证与授权

系统使用 JWT（JSON Web Token）进行用户认证，所有需要认证的接口都需要在请求头中添加 `Authorization: Bearer {token}`。

### 4.1 权限控制

| 角色   | 权限             |
| ---- | -------------- |
| 普通用户 | 可创建、编辑和管理自己的文档 |
| 管理员  | 可管理所有用户和文档     |

## 5. 接口示例

### 5.1 创建新文档

**请求**：

```http
POST /api/v1/documents
Content-Type: application/json

{
  "title": "新型冠状病毒肺炎治疗方案",
  "keywords": ["新冠病毒", "治疗方案", "临床试验"],
  "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
  "content": "参考正文内容...",
  "purpose": "临床"
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "document_id": "123456",
    "title": "新型冠状病毒肺炎治疗方案",
    "keywords": ["新冠病毒", "治疗方案", "临床试验"],
    "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
    "content": "参考正文内容...",
    "purpose": "临床",
    "status": "draft",
    "created_at": "2026-02-24T13:37:00Z",
    "updated_at": "2026-02-24T13:37:00Z"
  }
}
```

### 5.2 生成方案结构

**请求**：

```http
POST /api/v1/documents/123456/generate
Content-Type: application/json
```

**响应**：

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

### 5.3 AI 帮填段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/assist?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

流式响应，实时返回生成的内容：

```
data: {"content": "肩颈疼痛是全球最普遍的肌肉骨骼疾病，已成为重大公共卫生挑战。据世界卫生组织统计，全球约有10亿人患有不同程度的肩颈疼痛，每年因肩颈疼痛导致的工作日损失超过2亿天，给社会经济带来巨大负担。肩颈疼痛不仅影响患者的生活质量，还可能导致焦虑、抑郁等心理问题。"}

...

data: [DONE]
```

### 5.4 更新章节信息

**请求**：

```http
PUT /api/v1/chapters/789012
Content-Type: application/json

{
  "title": "研究背景与目的",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "保存成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究背景与目的",
    "order_index": 1,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.5 AI 评估段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/evaluate?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

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

### 5.6 新增章节

**请求**：

```http
POST /api/v1/chapters
Content-Type: application/json

{
  "document_id": "123456",
  "parent_id": null,
  "order_index": 3,
  "title": "研究方法"
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究方法",
    "order_index": 3,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.7 创建段落

**请求**：

```http
POST /api/v1/chapters/789012/paragraphs
Content-Type: application/json

{
  "content": "研究背景与目的",
  "para_type": "heading-1",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "paragraph_id": "paragraph_id",
    "chapter_id": "789012",
    "content": "研究背景与目的",
    "para_type": "heading-1",
    "order_index": 1,
    "ai_eval": null,
    "ai_suggestion": null
  }
}
```

### 5.8 删除章节

**请求**：

```http
POST /api/v1/documents
Content-Type: application/json

{
  "title": "新型冠状病毒肺炎治疗方案",
  "keywords": ["新冠病毒", "治疗方案", "临床试验"],
  "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
  "content": "参考正文内容...",
  "purpose": "临床"
}
```

```http
DELETE /api/v1/chapters/789012
Content-Type: application/json
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "document_id": "123456",
    "title": "新型冠状病毒肺炎治疗方案",
    "keywords": ["新冠病毒", "治疗方案", "临床试验"],
    "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
    "content": "参考正文内容...",
    "purpose": "临床",
    "status": "draft",
    "created_at": "2026-02-24T13:37:00Z",
    "updated_at": "2026-02-24T13:37:00Z"
  }
}
```

### 5.2 生成方案结构

**请求**：

```http
POST /api/v1/documents/123456/generate
Content-Type: application/json
```

**响应**：

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

### 5.3 AI 帮填段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/assist?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

流式响应，实时返回生成的内容：

```
data: {"content": "肩颈疼痛是全球最普遍的肌肉骨骼疾病，已成为重大公共卫生挑战。据世界卫生组织统计，全球约有10亿人患有不同程度的肩颈疼痛，每年因肩颈疼痛导致的工作日损失超过2亿天，给社会经济带来巨大负担。肩颈疼痛不仅影响患者的生活质量，还可能导致焦虑、抑郁等心理问题。"}

...

data: [DONE]
```

### 5.4 更新章节信息

**请求**：

```http
PUT /api/v1/chapters/789012
Content-Type: application/json

{
  "title": "研究背景与目的",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "保存成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究背景与目的",
    "order_index": 1,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.5 AI 评估段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/evaluate?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

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

### 5.6 新增章节

**请求**：

```http
POST /api/v1/chapters
Content-Type: application/json

{
  "document_id": "123456",
  "parent_id": null,
  "order_index": 3,
  "title": "研究方法"
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究方法",
    "order_index": 3,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.7 创建段落

**请求**：

```http
POST /api/v1/chapters/789012/paragraphs
Content-Type: application/json

{
  "content": "研究背景与目的",
  "para_type": "heading-1",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "paragraph_id": "paragraph_id",
    "chapter_id": "789012",
    "content": "研究背景与目的",
    "para_type": "heading-1",
    "order_index": 1,
    "ai_eval": null,
    "ai_suggestion": null
  }
}
```

### 5.8 删除章节

**请求**：

```http
POST /api/v1/documents
Content-Type: application/json

{
  "title": "新型冠状病毒肺炎治疗方案",
  "keywords": ["新冠病毒", "治疗方案", "临床试验"],
  "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
  "content": "参考正文内容...",
  "purpose": "临床"
}
```

```http
DELETE /api/v1/chapters/789012
Content-Type: application/json
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "document_id": "123456",
    "title": "新型冠状病毒肺炎治疗方案",
    "keywords": ["新冠病毒", "治疗方案", "临床试验"],
    "abstract": "本方案旨在评估XX药物在治疗新型冠状病毒肺炎中的有效性和安全性",
    "content": "参考正文内容...",
    "purpose": "临床",
    "status": "draft",
    "created_at": "2026-02-24T13:37:00Z",
    "updated_at": "2026-02-24T13:37:00Z"
  }
}
```

### 5.2 生成方案结构

**请求**：

```http
POST /api/v1/documents/123456/generate
Content-Type: application/json
```

**响应**：

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

### 5.3 AI 帮填段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/assist?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

流式响应，实时返回生成的内容：

```
data: {"content": "肩颈疼痛是全球最普遍的肌肉骨骼疾病，已成为重大公共卫生挑战。据世界卫生组织统计，全球约有10亿人患有不同程度的肩颈疼痛，每年因肩颈疼痛导致的工作日损失超过2亿天，给社会经济带来巨大负担。肩颈疼痛不仅影响患者的生活质量，还可能导致焦虑、抑郁等心理问题。"}

...

data: [DONE]
```

### 5.4 更新章节信息

**请求**：

```http
PUT /api/v1/chapters/789012
Content-Type: application/json

{
  "title": "研究背景与目的",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "保存成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究背景与目的",
    "order_index": 1,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.5 AI 评估段落内容

**请求**：

```http
POST /api/v1/chapters/789012/ai/evaluate?paragraph_id=paragraph_id
Content-Type: application/json
```

**响应**：

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

### 5.6 新增章节

**请求**：

```http
POST /api/v1/chapters
Content-Type: application/json

{
  "document_id": "123456",
  "parent_id": null,
  "order_index": 3,
  "title": "研究方法"
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "chapter_id": "789012",
    "document_id": "123456",
    "parent_id": null,
    "title": "研究方法",
    "order_index": 3,
    "updated_at": "2026-02-24T13:37:00Z",
    "paragraphs": []
  }
}
```

### 5.7 创建段落

**请求**：

```http
POST /api/v1/chapters/789012/paragraphs
Content-Type: application/json

{
  "content": "研究背景与目的",
  "para_type": "heading-1",
  "order_index": 1
}
```

**响应**：

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "paragraph_id": "paragraph_id",
    "chapter_id": "789012",
    "content": "研究背景与目的",
    "para_type": "heading-1",
    "order_index": 1,
    "ai_eval": null,
    "ai_suggestion": null
  }
}
```

### 5.8 删除章节

**请求**：

```http
DELETE /api/v1/chapters/789012
Content-Type: application/json
```

**响应**：

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

