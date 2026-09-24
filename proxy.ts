import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE, verificarSesion } from '@/lib/auth/session'

// Rutas que no exigen sesión.
// ⚠️ /api/cron/* NO puede quedar detrás del login: el cron de Vercel envía las
// campañas programadas cada minuto y se autentica con su propio CRON_SECRET.
const PUBLICAS = [/^\/login$/, /^\/api\/auth\//, /^\/api\/cron\//]

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const esApi = pathname.startsWith('/api/')
  const sesion = await verificarSesion(request.cookies.get(SESSION_COOKIE)?.value)

  // Sayasend es solo para admins: los asesores trabajan en el CRM Educador.
  const esAdmin = sesion?.rol === 'admin'

  if (pathname === '/login' && esAdmin) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (PUBLICAS.some((re) => re.test(pathname))) {
    return NextResponse.next()
  }

  if (!esAdmin) {
    if (esApi) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', pathname + search)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Todo salvo estáticos de Next, scripts de Vercel (/_vercel) y archivos con extensión.
    '/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)',
  ],
}
