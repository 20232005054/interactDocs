# Tasks
- [x] Task 1: 编写并执行 BOM 移除脚本
  - [x] SubTask 1.1: 使用 Python 读取 `backend/services/ai_service.py` 文件。
  - [x] SubTask 1.2: 检查文件头部是否包含 `\xef\xbb\xbf` (BOM)。
  - [x] SubTask 1.3: 如果包含，去除这 3 个字节并覆盖写回文件。
- [x] Task 2: 验证修复结果
  - [x] SubTask 2.1: 运行 `python backend/main.py` 或尝试启动服务，确认不再出现 `U+FEFF` 报错。