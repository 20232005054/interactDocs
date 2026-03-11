import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; snapshotId: string }> }) {
  const { id, snapshotId } = await params;
  
  try {
    const response = await fetch(`http://127.0.0.1:8001/api/v1/documents/${id}/snapshots/detail/${snapshotId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch snapshot detail: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in snapshot detail proxy:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取快照详情失败',
        data: null,
      },
      { status: 500 }
    );
  }
}