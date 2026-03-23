import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    console.log('[Proxy] Fetching URL:', url);
    
    // Fetch the file from external URL
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('[Proxy] Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    // Get the file as a buffer
    const buffer = await response.arrayBuffer();
    
    // Check if the buffer is empty or too small to be a valid KMZ file
    if (buffer.byteLength === 0) {
      throw new Error('KMZ file is empty');
    }
    
    if (buffer.byteLength < 100) {
      throw new Error('KMZ file is too small to be valid');
    }

    console.log('[Proxy] Successfully fetched file, size:', buffer.byteLength, 'bytes');

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kmz',
        'Content-Disposition': 'attachment',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[Proxy] Error details:', error);
    
    let errorMessage = 'Failed to proxy file';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout - KMZ file took too long to load';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error - Unable to reach KMZ file URL';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
