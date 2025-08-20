import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security middleware to protect against CVE-2025-29927 and other vulnerabilities
export function middleware(request: NextRequest) {
  // Check for malicious x-middleware-subrequest header (CVE-2025-29927 protection)
  const suspiciousHeader = request.headers.get('x-middleware-subrequest');
  if (suspiciousHeader) {
    console.error(`[SECURITY] Blocked request with x-middleware-subrequest header: ${suspiciousHeader}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Authentication check for protected routes
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                          pathname.startsWith('/api/protected');

  if (isProtectedRoute) {
    const sessionToken = request.cookies.get('session')?.value;
    
    if (!sessionToken) {
      // Redirect to login for web routes, return 401 for API routes
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // In production, verify the session token here
    // For now, we'll pass through if token exists
  }

  // Add security headers
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '0'); // Modern browsers don't use this
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.planrrr.io; " +
      "frame-ancestors 'none';"
    );
  }

  return response;
}

// Configuration for which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};