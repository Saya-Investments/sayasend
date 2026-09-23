import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { firmarSesion, opcionesCookie, SESSION_COOKIE, type Rol } from '@/lib/auth/session'

export const TEMP_HASH = 'temp_hash'
export const MIN_PASSWORD = 8

export function normalizarEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

// Registra el login y devuelve la respuesta con la cookie de sesión puesta.
export async function responderConSesion(usuario: {
  id: string
  email: string
  nombre: string
  rol: string
}) {
  await prisma.crmUsuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  })
  const rol = usuario.rol as Rol
  const token = await firmarSesion({ sub: usuario.id, rol, nombre: usuario.nombre, email: usuario.email })
  const res = NextResponse.json({
    success: true,
    data: { rol, nombre: usuario.nombre, redirectTo: rol === 'admin' ? '/' : '/asesor' },
  })
  res.cookies.set(SESSION_COOKIE, token, opcionesCookie)
  return res
}
