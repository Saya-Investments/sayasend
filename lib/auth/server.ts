// Helpers de sesión para rutas de API y server components. El usuario SIEMPRE
// sale de la cookie firmada, nunca de un parámetro de la request.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, verificarSesion, type Rol, type Sesion } from '@/lib/auth/session'

export async function getSesion(): Promise<Sesion | null> {
  const store = await cookies()
  const sesion = await verificarSesion(store.get(SESSION_COOKIE)?.value)
  if (!sesion) return null

  // Un usuario desactivado pierde el acceso aunque su cookie siga vigente.
  const usuario = await prisma.crmUsuario.findUnique({
    where: { id: sesion.sub },
    select: { activo: true, rol: true },
  })
  if (!usuario?.activo) return null
  return { ...sesion, rol: usuario.rol as Rol }
}

export class ErrorAuth extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? 'No autenticado' : 'No autorizado')
  }
}

// Lanza ErrorAuth si no hay sesión o el rol no está permitido.
export async function requireSesion(...roles: Rol[]): Promise<Sesion> {
  const sesion = await getSesion()
  if (!sesion) throw new ErrorAuth(401)
  if (roles.length > 0 && !roles.includes(sesion.rol)) throw new ErrorAuth(403)
  return sesion
}

// Respuesta JSON uniforme para errores de las rutas de API.
export function respuestaError(error: unknown) {
  if (error instanceof ErrorAuth) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  const status = (error as { status?: number }).status
  const message = error instanceof Error ? error.message : 'Error desconocido'
  return NextResponse.json({ success: false, error: message }, { status: status ?? 500 })
}
