// Sesión firmada en cookie httpOnly. Solo usa `jose` para poder correr también
// en `proxy.ts` — no importar Prisma ni módulos de Node desde acá.
import { jwtVerify, SignJWT } from 'jose'

export const SESSION_COOKIE = 'sayasend_session'
export const SESSION_MAX_AGE_SEG = 12 * 60 * 60

export type Rol = 'admin' | 'asesor'

export type Sesion = {
  sub: string
  rol: Rol
  nombre: string
  email: string
}

function secretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET no está definido o tiene menos de 32 caracteres')
  }
  return new TextEncoder().encode(secret)
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ rol: sesion.rol, nombre: sesion.nombre, email: sesion.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sesion.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEG}s`)
    .sign(secretKey())
}

export async function verificarSesion(token: string | undefined | null): Promise<Sesion | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (!payload.sub || (payload.rol !== 'admin' && payload.rol !== 'asesor')) return null
    return {
      sub: payload.sub,
      rol: payload.rol,
      nombre: String(payload.nombre ?? ''),
      email: String(payload.email ?? ''),
    }
  } catch {
    return null
  }
}

export const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SEG,
}
