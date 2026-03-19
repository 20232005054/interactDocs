import dashscope
from http import HTTPStatus

# 通用通义千问流式调用函数
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
