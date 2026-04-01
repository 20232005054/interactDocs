from typing import Any, Dict, Optional
from jinja2 import Template


SUMMARY_TEMPLATE = """你是一个专业的临床研究方案摘要撰写助手。

请根据以下信息生成摘要内容：

文档标题：{{ title }}
{% if purpose %}
文档用途：{{ purpose }}
{% endif %}
{% if keywords %}
关键词：{{ keywords }}
{% endif %}
{% if sources_data %}
相关数据：
{{ sources_data }}
{% endif %}

要求：
1. 生成与{{ summary_type }}相关的摘要内容，直接切入主题
2. 内容要专业、准确，符合临床研究规范
3. 摘要内容控制在100-150字之间
4. 重点突出，信息明确，避免模糊表述
5. 直接输出摘要内容，使用纯文本格式
6. 不要使用任何标题符号或格式标记
"""

STRUCTURE_TEMPLATE = """你是一个专业的临床研究方案章节结构设计助手。

请根据以下信息生成章节结构：

文档标题：{{ title }}
{% if purpose %}
文档用途：{{ purpose }}
{% endif %}
{% if keywords %}
关键词：{{ keywords }}
{% endif %}
{% if sources_data %}
相关数据：
{{ sources_data }}
{% endif %}

要求：
1. 生成完整的章节结构，包括一级标题、二级标题，必要时可以有三级标题
2. 章节结构要符合临床研究方案的规范
3. 直接输出章节结构，每个标题占一行，使用Markdown格式表示层级
4. 不要添加任何其他内容
"""


def format_summary_prompt(
    title: str,
    summary_type: str,
    purpose: Optional[str] = None,
    keywords: Optional[str] = None,
    sources_data: Optional[str] = None,
    custom_template: Optional[str] = None,
    **kwargs: Any,
) -> str:
    template_str = custom_template or SUMMARY_TEMPLATE
    template = Template(template_str)
    return template.render(
        title=title,
        summary_type=summary_type,
        purpose=purpose,
        keywords=keywords,
        sources_data=sources_data,
        **kwargs,
    )


def format_structure_prompt(
    title: str,
    purpose: Optional[str] = None,
    keywords: Optional[str] = None,
    sources_data: Optional[str] = None,
    custom_template: Optional[str] = None,
    **kwargs: Any,
) -> str:
    template_str = custom_template or STRUCTURE_TEMPLATE
    template = Template(template_str)
    return template.render(
        title=title,
        purpose=purpose,
        keywords=keywords,
        sources_data=sources_data,
        **kwargs,
    )


def format_custom_prompt(
    template_str: str,
    **kwargs: Any,
) -> str:
    template = Template(template_str)
    return template.render(**kwargs)
