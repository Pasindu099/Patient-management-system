import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn   = !!req.auth

  const isAuthRoute      = pathname.startsWith('/login')
  const isProtectedRoute = pathname.startsWith('/dashboard') ||
                           pathname.startsWith('/patients') ||
                           pathname.startsWith('/appointments') ||
                           pathname.startsWith('/queue') ||
                           pathname.startsWith('/visits') ||
                           pathname.startsWith('/clinical') ||
                           pathname.startsWith('/diagnosis') ||
                           pathname.startsWith('/billing') ||
                           pathname.startsWith('/finance') ||
                           pathname.startsWith('/kpi') ||
                           pathname.startsWith('/staff-profile') ||
                           pathname.startsWith('/audit') ||
                           pathname.startsWith('/reports') ||
                           pathname.startsWith('/settings') ||
                           pathname.startsWith('/inventory')

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
