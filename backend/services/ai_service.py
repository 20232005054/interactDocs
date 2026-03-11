import dashscope
from http import HTTPStatus
import json
import uuid
from .prompt_templates import render_prompt, system_prompts

# 配置您的百炼 API Key
# dashscope.api_key = "您的阿里云百炼API_KEY"


async def get_ai_streaming_content(title: str, keywords: list, chapter_title: str, hierarchy_titles: list, current_content: str = "", summary_sections: str = None):
    """
    调用百炼 Qwen 模型生成段落内容
    """
    # 渲染提示词
    prompt = render_prompt(
        "assist",
        title=title,
        keywords=", ".join(keywords),
        chapter_title=chapter_title,
        hierarchy_titles=hierarchy_titles,
        summary_sections=summary_sections,
        current_content=current_content
    )

    responses = dashscope.Generation.call(
        model='qwen-max',  # 或者使用 qwen-plus
        messages=[
            {'role': 'system', 'content': system_prompts["assist"]},
            {'role': 'user', 'content': prompt}
        ],
        result_format='message',
        stream=True,
        incremental_output=True
    )

    for response in responses:
        if response.status_code == HTTPStatus.OK:
            content = response.output.choices[0]['message']['content']
            # 封装为前端易读的 SSE 格式
            yield f"data: {json.dumps({'content': content})}\n\n"
        else:
            yield f"data: {json.dumps({'error': 'AI 生成失败'})}\n\n"


async def call_qwen_stream(system_prompt: str, history: list, user_input: str):
    """
    通用通义千问流式调用函数
    """
    messages = [{'role': 'system', 'content': system_prompt}] + history + [{'role': 'user', 'content': user_input}]

    responses = dashscope.Generation.call(
        model='qwen-max',
        messages=messages,
        result_format='message',
        stream=True,
        incremental_output=True
    )

    for response in responses:
        if response.status_code == HTTPStatus.OK:
            yield response.output.choices[0]['message']['content']
        else:
            # 错误处理逻辑
            error_msg = f"AI 调用失败: {response.message}"
            yield f"Error: {error_msg}"


async def get_ai_evaluation(title: str, keywords: list, chapter_title: str, hierarchy_titles: list, paragraph_title: str, paragraph_content: str, summary_sections: str = None):
    """
    调用百炼 Qwen 模型评估段落内容
    """
    # 渲染提示词
    prompt = render_prompt(
        "evaluate",
        title=title,
        keywords=", ".join(keywords),
        chapter_title=chapter_title,
        hierarchy_titles=hierarchy_titles,
        summary_sections=summary_sections,
        paragraph_title=paragraph_title,
        paragraph_content=paragraph_content
    )

    response = dashscope.Generation.call(
        model='qwen-max',
        messages=[
            {'role': 'system', 'content': system_prompts["evaluate"]},
            {'role': 'user', 'content': prompt}
        ],
        result_format='message'
    )

    if response.status_code == HTTPStatus.OK:
        content = response.output.choices[0]['message']['content']
        # 解析评估结果和建议
        # 这里简化处理，实际项目中可能需要更复杂的解析
        evaluation = content.split('改进建议')[0].strip()
        suggestions = []
        if '改进建议' in content:
            suggestions_part = content.split('改进建议')[1].strip()
            # 简单提取建议列表
            for line in suggestions_part.split('\n'):
                line = line.strip()
                if line and (line.startswith('1.') or line.startswith('2.') or line.startswith('3.')):
                    suggestions.append(line[2:].strip())
        if not suggestions:
            suggestions = ['建议增加更多具体的数据支持', '可以补充一些最新的研究进展', '建议优化部分专业术语的表述']
        return evaluation, suggestions
    else:
        return '章节内容评估失败', ['请检查内容是否完整', '请确保内容符合临床研究规范', '建议重新提交评估']


async def get_ai_revision(chapter_content: list, instruction: str):
    """
    调用百炼 Qwen 模型修订章节内容
    """
    # 将Block Schema格式转换为纯文本，支持嵌套的children结构
    def convert_block_to_text(block, level=0):
        text = ""
        block_type = block.get('type')
        content = block.get('content', '')
        
        if block_type == 'heading-1':
            text += f"{'#' * 1} {content}\n\n"
        elif block_type == 'heading-2':
            text += f"{'#' * 2} {content}\n\n"
        elif block_type == 'heading-3':
            text += f"{'#' * 3} {content}\n\n"
        elif block_type == 'paragraph':
            text += f"{content}\n\n"
        elif block_type == 'list':
            items = block.get('items', [])
            for item in items:
                text += f"- {item}\n"
            text += "\n"
        
        # 处理children
        children = block.get('children', [])
        for child in children:
            text += convert_block_to_text(child, level + 1)
        
        return text
    
    # 转换所有block
    text_content = ""
    for block in chapter_content:
        text_content += convert_block_to_text(block)

    # 渲染提示词
    prompt = render_prompt(
        "revision",
        instruction=instruction,
        text_content=text_content
    )

    response = dashscope.Generation.call(
        model='qwen-max',
        messages=[
            {'role': 'system', 'content': system_prompts["revision"]},
            {'role': 'user', 'content': prompt}
        ],
        result_format='message'
    )

    if response.status_code == HTTPStatus.OK:
        # 将修订后的纯文本转换回Block Schema格式
        revised_text = response.output.choices[0]['message']['content']
        
        # 处理AI响应，移除[ACTION]指令和重复内容
        if '[ACTION]' in revised_text:
            parts = revised_text.split('[ACTION]')
            revised_text = parts[0].strip()
        
        # 移除重复内容
        lines = revised_text.split('\n')
        seen_lines = set()
        unique_lines = []
        for line in lines:
            line = line.strip()
            if line and line not in seen_lines:
                seen_lines.add(line)
                unique_lines.append(line)
        revised_text = ' '.join(unique_lines)
        
        # 这里简化处理，实际项目中可能需要更复杂的解析
        # 简单将修订后的内容作为一个段落Block
        revised_content = [{
            "id": str(uuid.uuid4()),
            "type": "paragraph",
            "content": revised_text,
            "metadata": {}
        }]
        return revised_content
    else:
        return chapter_content


async def generate_chapter_titles(title: str, keywords: list, abstract: str = None, content: str = None, purpose: str = None):
    """
    调用百炼 Qwen 模型根据文档信息生成章节标题
    """
    # 渲染提示词
    prompt = render_prompt(
        "generate_chapters",
        title=title,
        keywords=", ".join(keywords),
        abstract=abstract,
        content=content,
        purpose=purpose
    )

    response = dashscope.Generation.call(
        model='qwen-max',
        messages=[
            {'role': 'system', 'content': system_prompts["generate_chapters"]},
            {'role': 'user', 'content': prompt}
        ],
        result_format='message'
    )

    if response.status_code == HTTPStatus.OK:
        content = response.output.choices[0]['message']['content']
        # 解析章节标题列表
        chapter_titles = []
        for line in content.strip().split('\n'):
            line = line.strip()
            if line and not line.startswith('===') and not line.startswith('---'):
                # 移除可能的序号和标点
                if any(line.startswith(str(i) + '.') for i in range(1, 10)):
                    line = line.split('.', 1)[1].strip()
                elif any(line.startswith(str(i) + ')') for i in range(1, 10)):
                    line = line.split(')', 1)[1].strip()
                chapter_titles.append(line)
        # 确保至少有3个章节
        if len(chapter_titles) < 3:
            chapter_titles.extend(["项目背景", "研究方法", "研究结果"])
        return chapter_titles[:8]  # 最多返回8个章节
    else:
        # 返回默认章节结构
        return ["项目核心信息", "方案摘要", "方案全文"]