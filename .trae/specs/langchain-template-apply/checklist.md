# Checklist

## 分支和依赖
- [x] langchain 分支创建成功
- [x] LangChain 依赖安装成功

## LangChain 模块
- [x] config.py 配置管理正确，支持环境变量
- [x] llm.py LLM 封装正确，支持重试、超时、并发控制
- [x] prompts.py 提示词管理正确，支持变量替换
- [x] parsers.py 输出解析正确，支持多种格式
- [x] sources.py 数据来源构建正确，支持 keyinfo/summary/chapter

## 应用模板服务
- [x] document_service_v2.py 创建成功
- [x] 应用核心信息模板功能正常
- [x] 应用摘要模板（复制模式）功能正常
- [x] 应用摘要模板（AI 模式）功能正常
- [x] 应用结构模板（复制模式）功能正常
- [x] 应用结构模板（AI 模式）功能正常

## API 路由
- [x] 配置开关控制正常
- [x] USE_LANGCHAIN=true 时使用新服务
- [x] USE_LANGCHAIN=false 时使用旧服务

## 降级和错误处理
- [x] AI 调用失败时自动降级到复制模式
- [x] 错误信息正确记录和返回
- [x] 依赖边正确创建

## 代码质量
- [x] 模块高内聚低耦合
- [x] 代码可复用性强
- [x] 与现有代码兼容