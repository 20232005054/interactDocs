# Tasks
- [x] Task 1: 修复 `Document.template` 的 relationship 定义
  - [x] SubTask 1.1: 打开 `backend/db/models.py` 文件。
  - [x] SubTask 1.2: 找到 `Document` 类中的 `template = relationship("Template", backref="documents")` 这一行。
  - [x] SubTask 1.3: 将其修改为 `template = relationship("Template", foreign_keys=[template_id], backref="documents")`。
- [x] Task 2: 验证修复结果
  - [x] SubTask 2.1: 运行 `python backend/main.py` 启动服务。
  - [x] SubTask 2.2: 确认终端不再输出 `AmbiguousForeignKeysError` 错误。