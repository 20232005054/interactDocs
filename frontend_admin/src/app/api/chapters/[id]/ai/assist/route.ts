import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const response = await fetch(`http://127.0.0.1:8001/api/v1/chapters/${id}/ai/assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to assist chapter: ${response.status} ${response.statusText}`);
    }

    // 检查是否是流式响应
    if (response.body) {
      // 创建一个新的响应，直接转发流式数据
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } else {
      // 如果不是流式响应，尝试解析为JSON
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error in AI assist proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: 'AI帮填失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
