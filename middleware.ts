import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtDecrypt } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'deokso-education-church-summer-camp-2026-secret-key-32bytes-length!';
const key = new TextEncoder().encode(SECRET_KEY.slice(0, 32));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes
  const isAdminRoute = pathname.includes('/admin') && !pathname.includes('/admin/login') && !pathname.includes('/api/admin/login');

  if (isAdminRoute) {
    const sessionCookie = request.cookies.get('admin_session');

    if (!sessionCookie) {
      // Determine department from pathname
      let dept = 'kinder';
      if (pathname.includes('/kids')) dept = 'kids';
      if (pathname.includes('/teens')) dept = 'teens';

      // Redirect to login page
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('dept', dept);
      loginUrl.searchParams.set('callback', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Try to decrypt the session
      const { payload } = await jwtDecrypt(sessionCookie.value, key);
      
      // Basic route match verification (e.g. kinder admin shouldn't access kids admin)
      if (pathname.includes('/kinder') && payload.department !== 'kinder') {
        throw new Error('Unauthorized department');
      }
      if (pathname.includes('/kids') && payload.department !== 'kids') {
        throw new Error('Unauthorized department');
      }
      if (pathname.includes('/teens') && payload.department !== 'teens') {
        throw new Error('Unauthorized department');
      }

      // Valid session, proceed
      return NextResponse.next();
    } catch (err) {
      console.warn("Middleware admin session check failed:", err);
      // Clear cookie and redirect to login
      let dept = 'kinder';
      if (pathname.includes('/kids')) dept = 'kids';
      if (pathname.includes('/teens')) dept = 'teens';

      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('dept', dept);
      loginUrl.searchParams.set('callback', pathname);
      
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*/admin/:path*', '/kinder/admin/:path*', '/kids/admin/:path*', '/teens/admin/:path*'],
};
