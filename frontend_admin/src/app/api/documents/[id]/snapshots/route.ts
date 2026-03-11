import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const response = await fetch(`http://127.0.0.1:8001/api/v1/documents/${id}/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create snapshot: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in snapshot creation proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '创建快照失败',
        data: null,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const response = await fetch(`http://127.0.0.1:8001/api/v1/documents/${id}/snapshots`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in snapshot fetch proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取快照列表失败',
        data: null,
      },
      { status: 500 }
    );
  }
}