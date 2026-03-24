import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.104.44:8001";

async function handleRequest(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/${path}${queryString ? `?${queryString}` : ""}`;

  try {
    const headers: Record<string, string> = {};
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const body = request.method !== "GET" && request.method !== "HEAD" 
      ? await request.text() 
      : undefined;

    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const responseData = await response.text();
    
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
