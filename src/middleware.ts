import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware handles WebSocket upgrade requests
export function middleware(request: NextRequest) {
  // Only handle WebSocket upgrade requests to the socket path
  if (
    request.nextUrl.pathname.startsWith('/api/socket') &&
    request.headers.get('upgrade') === 'websocket'
  ) {
    // Return a response that allows the WebSocket upgrade
    // The actual WebSocket handling happens in the server.js file
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure the middleware to run for specific paths
export const config = {
  matcher: ['/api/socket/:path*'],
};
