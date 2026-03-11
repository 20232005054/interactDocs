import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch('http://127.0.0.1:8001/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to chat with AI: ${response.status} ${response.statusText}`);
    }

    // 直接返回原始的流式响应
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error in AI chat proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: 'AI聊天失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
