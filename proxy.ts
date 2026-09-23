import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE, verificarSesion } from '@/lib/auth/session'

// Rutas que no exigen sesión.
// ⚠️ /api/cron/* NO puede quedar detrás del login: el cron de Vercel envía las
// campañas programadas cada minuto y se autentica con su propio CRON_SECRET.
const PUBLICAS = [/^\/login$/, /^\/api\/auth\//, /^\/api\/cron\//]

// Lo único que puede tocar un asesor. Todo lo demás es del admin.
const PAGINAS_ASESOR = /^\/asesor(\/|$)/
const APIS_ASESOR = /^\/api\/(bot|auth)\//

const inicioPorRol = { admin: '/', asesor: '/asesor' } as const

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const esApi = pathname.startsWith('/api/')
  const sesion = await verificarSesion(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === '/login' && sesion) {
    return NextResponse.redirect(new URL(inicioPorRol[sesion.rol], request.url))
  }

  if (PUBLICAS.some((re) => re.test(pathname))) {
    return NextResponse.next()
  }

  if (!sesion) {
    if (esApi) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    const login = new URL('/login', request.url)
    if (pathname !== '/') login.searchParams.set('next', pathname + search)
    return NextResponse.redirect(login)
  }

  if (sesion.rol === 'asesor') {
    if (esApi && !APIS_ASESOR.test(pathname)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }
    if (!esApi && !PAGINAS_ASESOR.test(pathname)) {
      return NextResponse.redirect(new URL('/asesor', request.url))
    }
  }

  if (sesion.rol === 'admin' && PAGINAS_ASESOR.test(pathname)) {
    return NextResponse.redirect(new URL('/bot', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Todo salvo estáticos de Next, scripts de Vercel (/_vercel) y archivos con extensión.
    '/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)',
  ],
}
