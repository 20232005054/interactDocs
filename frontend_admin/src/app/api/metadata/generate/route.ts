import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch('http://127.0.0.1:8001/api/v1/metadata/generate', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in metadata proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取元数据失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
