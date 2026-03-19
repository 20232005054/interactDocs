from jinja2 import Template

# 系统提示词模板
system_prompts = {
    "assist": "你是一个专业的临床试验方案辅助撰写助手。",
    "evaluate": "你是一个专业的临床试验方案评估专家。",
    "revision": "你是一位资深的临床研究方案修订专家。",
    "generate_chapters": "你是一个专业的临床试验方案辅助撰写助手。",
    "extract_keywords": "你是一个专业的关键词提取助手。",
    "generate_summary": "你是一个专业的临床研究方案摘要撰写助手。",
    "analyze_content_change": "你是一个专业的文本分析助手。",
    "generate_summary_topics": "你是一个专业的临床研究方案摘要撰写助手。",
    "generate_chapter_structure": "你是一个专业的临床研究方案章节结构设计助手。",
    "generate_summary_titles": "你是一个专业的临床研究方案摘要标题设计助手。"
}

# 用户提示词模板
user_prompt_templates = {
    "assist": Template("""
你是一位资深的临床研究方案撰写专家。
项目标题：{{ title }}
研究关键词：{{ keywords }}
章节标题：{{ chapter_title }}
{% if hierarchy_titles %}
层级标题：
{% for t in hierarchy_titles %}
{{ t['type'].replace('heading-', 'H') }}: {{ t['content'] }}
{% endfor %}
{% endif %}
{% if summary_sections %}
摘要信息：
{{ summary_sections }}
{% endif %}
{% if current_content %}
当前段落内容：{{ current_content }}
{% endif %}
当前任务：请基于以上信息，为该段落撰写专业的内容。
要求：符合临床研究规范，逻辑严密，语言专业，直接输出段落内容，使用纯文本格式，不要使用Markdown格式，不要重复标题信息。
"""),
    
    "evaluate": Template("""
你是一位资深的临床研究方案评估专家。
请对以下段落内容进行专业评估：

项目标题：{{ title }}
研究关键词：{{ keywords }}
章节标题：{{ chapter_title }}
{% if hierarchy_titles %}
层级标题：
{% for t in hierarchy_titles %}
{{ t['type'].replace('heading-', 'H') }}: {{ t['content'] }}
{% endfor %}
{% endif %}
{% if summary_sections %}
摘要信息：
{{ summary_sections }}
{% endif %}
段落标题：{{ paragraph_title }}
段落内容：{{ paragraph_content }}

评估要求：
1. 分析内容的专业性、完整性和逻辑性
2. 给出具体的评估结果
3. 提供至少3条改进建议
4. 评估结果和建议要具体、实用
5. 使用纯文本格式，不要使用Markdown格式，不要使用任何标题符号、列表符号或格式标记
6. 直接输出评估结果和建议，不要有任何引言或开场白
"""),
    
    "revision": Template("""
你是一位资深的临床研究方案修订专家。
请根据以下指令修订章节内容：

修订指令：{{ instruction }}

当前章节内容：
{{ text_content }}

修订要求：
1. 严格按照指令进行修订
2. 保持内容的专业性和逻辑性
3. 直接输出修订后的完整内容
4. 不要添加任何额外的说明或解释
"""),
    
    "generate_chapters": Template("""
你是一位资深的临床研究方案撰写专家。
项目标题：{{ title }}
研究关键词：{{ keywords }}
{% if abstract %}
正文摘要：{{ abstract }}
{% endif %}
{% if content %}
参考正文：{{ content }}
{% endif %}
{% if purpose %}
使用目的：{{ purpose }}
{% endif %}
当前任务：请根据以上信息，为该临床研究方案生成一个合理的章节结构，只需要输出章节标题列表。
要求：
1. 章节结构要符合临床研究方案的规范
2. 章节标题要具体、专业，能够涵盖研究的主要内容
3. 章节数量要合理，通常为 3-8 个章节
4. 只输出章节标题列表，每个标题占一行，不要添加任何序号或其他内容
"""),
    
    "extract_keywords": Template("""
请根据以下文档信息，生成相关的关键词列表：

文档标题：{{ title }}
文档摘要：{{ abstract or '无' }}
文档目的：{{ purpose or '无' }}
{% if keywords %}
现有关键词：{{ keywords }}
{% endif %}

要求：
1. 生成 5-10 个与文档内容相关的关键词
2. 关键词要具体、准确，能够反映文档的核心内容
3. 直接输出关键词列表，每个关键词占一行
4. 不要添加任何序号或其他内容
"""),
    
    "generate_summary": Template("""
请根据以下文档信息，为{{ summary_type }}生成简洁明了的摘要：

文档标题：{{ title }}
文档摘要：{{ abstract or '无' }}
文档目的：{{ purpose or '无' }}
{% if keywords %}
关键词：{{ keywords }}
{% endif %}

要求：
1. 生成与{{ summary_type }}相关的摘要内容，直接切入主题
2. 内容要专业、准确，符合临床研究规范
3. 摘要内容控制在100-150字之间，不要生成一大段文字
4. 重点突出，信息明确，避免模糊表述
5. 直接输出摘要内容，使用纯文本格式
6. 不要使用任何标题符号或格式标记
"""),

    
    "generate_summary_topics": Template("""
请根据以下文档信息，生成4-6个不同的摘要主题：

文档标题：{{ title }}
文档摘要：{{ abstract or '无' }}
文档目的：{{ purpose or '无' }}
{% if keywords %}
关键词：{{ keywords }}
{% endif %}

要求：
1. 生成4-6个不同的摘要主题，每个主题针对临床研究方案的不同方面
2. 主题要简洁明了，4-6个字为宜，如：试验名称、试验目的、研究设计、试验组、对照组、样本量、病例选择、治疗与随访、评价指标等
3. 确保各个主题之间有明显的区别，不要重叠或关系不清
4. 直接输出主题列表，每个主题占一行
5. 不要添加任何序号或其他格式标记
"""),
    
    "generate_chapter_structure": Template("""
请根据以下摘要信息，生成完整的章节结构：

摘要信息：
{{ summary_info }}

要求：
1. 生成完整的章节结构，包括一级标题、二级标题，必要时可以有三级标题
2. 章节结构要符合临床研究方案的规范
3. 直接输出章节结构，每个标题占一行，使用Markdown格式表示层级
4. 不要添加任何其他内容
"""),
    
    "generate_summary_titles": Template("""
请根据以下文档信息，生成适合的摘要标题列表：

文档标题：{{ title }}
文档摘要：{{ abstract or '无' }}
文档目的：{{ purpose or '无' }}
{% if keywords %}
关键词：{{ keywords }}
{% endif %}

要求：
1. 根据文档目的"{{ purpose }}"，生成4-6个适合的摘要标题
2. 标题要简洁明了，4-6个字为宜
3. 标题要符合{{ purpose }}的专业规范
4. 直接输出标题列表，每个标题占一行
5. 不要添加任何序号或其他格式标记
"""),

    "analyze_content_change": Template("""
你是一位专业的文本分析专家。
请比较以下两段文本，判断它们是否发生了实质性的语义变更。

旧文本：
{{ old_content }}

新文本：
{{ new_content }}

判断标准：
1. 如果只是格式、标点、空格的修改，不算实质性变更
2. 如果只是个别字词的替换但意思不变，不算实质性变更
3. 如果内容的核心含义、关键信息发生了变化，算实质性变更
4. 如果添加了新的重要信息或删除了关键信息，算实质性变更

请只回答 "true" 或 "false"：
- "true" 表示发生了实质性变更
- "false" 表示没有发生实质性变更
"""),

    "assist_summary": Template("""
你是一个专业的临床研究方案摘要撰写助手。

请根据以下摘要数据，填充缺失的内容：
{{ summary_data }}

要求：
1. 分析摘要数据，识别缺失的内容
2. **重要**：只有当标题为空时，才需要生成新标题；如果标题已存在，请勿修改标题
3. 根据文档信息和关键词，生成合适的内容
4. 确保生成的内容专业、准确，符合临床研究规范
5. 直接输出结果，格式如下：
标题：[如果原标题为空则生成新标题，否则使用原标题]
内容：[生成的内容]
6. 只输出标题和内容，不要添加任何其他说明文字
""")
}

# 渲染提示词
def render_prompt(template_name, **kwargs):
    template = user_prompt_templates.get(template_name)
    if not template:
        return ""
    return template.render(**kwargs)
