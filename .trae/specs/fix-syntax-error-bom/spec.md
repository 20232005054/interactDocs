# Fix SyntaxError BOM Spec

## Why
终端在启动后端服务时抛出了错误：`SyntaxError: invalid non-printable character U+FEFF`，报错文件定位在 `backend/services/ai_service.py`。
这是一个典型的编码问题。`U+FEFF` 是 UTF-8 编码的 BOM (Byte Order Mark) 标记。Python 解释器在读取包含 BOM 的源码文件时，会将其视为非法的不可见字符并抛出语法错误。这通常是因为在 Windows 环境下使用某些编辑器（如记事本）保存文件时，默认添加了 BOM 导致的。

## What Changes
- 编写并执行一个 Python 脚本，读取 `backend/services/ai_service.py` 文件的二进制内容。
- 检测文件开头是否包含 UTF-8 的 BOM 标记 (`\xef\xbb\xbf`)。
- 如果存在，则将其剔除并重新以纯 UTF-8 格式（无 BOM）保存文件。

## Impact
- Affected code: `backend/services/ai_service.py` (仅修改文件编码格式，不修改业务逻辑代码)。
- Affected specs: 修复了阻止后端服务启动的致命语法错误。

## ADDED Requirements
### Requirement: 移除代码文件中的 BOM 标记
确保项目中的 Python 源码文件编码为标准的纯 UTF-8，不包含 BOM。

#### Scenario: Success case
- **WHEN** 执行修复脚本后
- **THEN** `ai_service.py` 文件开头的 `U+FEFF` 被移除，再次运行 `main.py` 时不再抛出该 SyntaxError。