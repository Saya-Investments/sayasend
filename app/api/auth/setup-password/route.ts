import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { MIN_PASSWORD, normalizarEmail, responderConSesion, TEMP_HASH } from '@/lib/auth/login'

export const runtime = 'nodejs'

// POST /api/auth/setup-password  { email, password }
// Solo sirve para usuarios con password_hash = 'temp_hash' (recién creados o
// con la contraseña reseteada por el admin). Fija la contraseña e inicia sesión.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = normalizarEmail(body.email)
    const password = String(body.password ?? '')

    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` },
        { status: 400 },
      )
    }

    const usuario = await prisma.crmUsuario.findUnique({ where: { email } })
    if (!usuario || !usuario.activo || usuario.passwordHash !== TEMP_HASH || usuario.rol !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Este usuario no tiene un cambio de contraseña pendiente' },
        { status: 400 },
      )
    }

    // updateMany con la condición evita que dos requests simultáneas fijen la
    // contraseña: solo la primera encuentra todavía el temp_hash.
    const { count } = await prisma.crmUsuario.updateMany({
      where: { id: usuario.id, passwordHash: TEMP_HASH },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    })
    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'Este usuario no tiene un cambio de contraseña pendiente' },
        { status: 400 },
      )
    }

    return responderConSesion(usuario)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
