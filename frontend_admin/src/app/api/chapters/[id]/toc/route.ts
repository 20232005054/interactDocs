export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  
  console.log('API TOC route called for chapter:', id);
  
  try {
    console.log('Calling backend TOC API:', `http://localhost:8001/api/v1/chapters/${id}/toc`);
    const response = await fetch(`http://localhost:8001/api/v1/chapters/${id}/toc`);
    
    console.log('Backend TOC API response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Failed to fetch chapter TOC');
    }
    
    const data = await response.json();
    console.log('Backend TOC API response data:', data);
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error proxying chapter TOC request:', error);
    return new Response(JSON.stringify({
      code: 500,
      message: 'Failed to fetch chapter TOC',
      data: null
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
