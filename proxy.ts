import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'godude_admin_session';

function hasValidUnexpiredShape(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  try {
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(atob(pad)) as { role?: string; exp?: number; email?: string };
    return (
      json.role === 'admin' &&
      typeof json.email === 'string' &&
      typeof json.exp === 'number' &&
      Date.now() <= json.exp * 1000
    );
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const hasCookie = hasValidUnexpiredShape(token);

  if (pathname === '/login') {
    if (hasCookie) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!hasCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Administrator authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
