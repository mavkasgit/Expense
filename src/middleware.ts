import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Проверяем наличие auth cookies от Supabase
  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(cookie => 
    cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )
  
  console.log('🍪 Auth cookie found:', hasAuthCookie)
  
  const protectedPrefixes = [
    '/dashboard',
    '/expenses',
    '/categories',
    '/analytics',
    '/cities',
    '/keywords',
  ]

  const isProtectedRoute = protectedPrefixes.some(prefix => 
    request.nextUrl.pathname.startsWith(prefix)
  )

  // Если это защищенный маршрут и нет токенов аутентификации
  if (isProtectedRoute && !hasAuthCookie) {
    console.log(`🔒 Redirecting ${request.nextUrl.pathname} -> /login (no auth)`)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Перенаправляем аутентифицированных пользователей с страниц входа
  if ((request.nextUrl.pathname.startsWith('/login') || 
       request.nextUrl.pathname.startsWith('/signup')) && 
       hasAuthCookie) {
    console.log(`✅ Redirecting ${request.nextUrl.pathname} -> /dashboard (authenticated)`)
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (OAuth callback)
     * - auth/confirm (email confirmation)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback|auth/confirm).*)',
  ],
}